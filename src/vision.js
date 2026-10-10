import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function pngSize(data) {
  if (data.length < 24 || data.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('INVALID_PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

export function mapping(bounds, width, height) {
  if (![bounds.x, bounds.y, bounds.width, bounds.height, width, height].every(Number.isFinite)
      || Math.min(bounds.width, bounds.height, width, height) <= 0) throw new Error('INVALID_IMAGE_MAPPING');
  return { origin: [bounds.x, bounds.y], screenPerPixel: [bounds.width / width, bounds.height / height], width, height };
}

export function imagePoint(map, x, y) {
  if (!map || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
    throw new Error('POINT_OUTSIDE_OBSERVED_IMAGE');
  }
  return { x: Math.round(map.origin[0] + x * map.screenPerPixel[0]),
    y: Math.round(map.origin[1] + y * map.screenPerPixel[1]) };
}

export async function attachScreenshot(shot, { attachments, imageCapable = false, vision = true, visionMaxPixels = 640000 } = {}) {
  if (!shot) return {};
  let data = shot.data ?? await readFile(shot.path);
  let size = pngSize(data);
  let path = shot.path;
  if (size.width * size.height > visionMaxPixels) {
    const { default: sharp } = await import('sharp');
    const ratio = Math.sqrt(visionMaxPixels / (size.width * size.height));
    data = await sharp(data).resize({ width: Math.max(1, Math.floor(size.width * ratio)),
      height: Math.max(1, Math.floor(size.height * ratio)), fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    size = pngSize(data);
    path = join(await mkdtemp(join(tmpdir(), 'dsh-fusion-image-')), 'window.png');
    await writeFile(path, data);
  }
  let map = mapping(shot.bounds, size.width, size.height);
  const base = { screenshot: { path, width: size.width, height: size.height,
    method: shot.method, occludedPossible: shot.occludedPossible }, mapping: map };
  if (!vision || !imageCapable || !attachments?.saveImage) return base;
  try {
    const ref = await attachments.saveImage({ data, mediaType: 'image/png', name: 'computer-use-fusion.png' });
    // Include host attachment normalization in the one authoritative transform.
    map = mapping(shot.bounds, ref.width ?? size.width, ref.height ?? size.height);
    return { ...base, mapping: map, image: ref };
  } catch {
    return { ...base, imageWarning: 'Image attachment failed; screenshot path and mapping remain available.' };
  }
}
