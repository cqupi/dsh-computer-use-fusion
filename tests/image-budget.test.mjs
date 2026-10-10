import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readFile, rm, rmdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { attachScreenshot, pngSize } from '../src/vision.js';

test('shared vision stage bounds a real PNG and keeps saved-file coordinates exact', async () => {
  const data = await sharp({ create: { width: 4000, height: 1000, channels: 3, background: '#123456' } }).png().toBuffer();
  const result = await attachScreenshot({ data, bounds: { x: -2000, y: 50, width: 2000, height: 500 } });
  try {
    const size = pngSize(await readFile(result.screenshot.path));
    assert.ok(size.width * size.height <= 640000);
    assert.equal(result.mapping.screenPerPixel[0] * size.width, 2000);
    assert.equal(result.mapping.screenPerPixel[1] * size.height, 500);
  } finally { await rm(result.screenshot.path); await rmdir(dirname(result.screenshot.path)); }
});
