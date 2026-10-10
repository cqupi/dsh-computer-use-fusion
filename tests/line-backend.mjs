import { createInterface } from 'node:readline';
createInterface({ input: process.stdin }).on('line', async line => {
  const request = JSON.parse(line);
  if (request.action === 'slow') await new Promise(resolve => setTimeout(resolve, 500));
  process.stdout.write(JSON.stringify({ id: request.id, ok: true, action: request.action }) + '\n');
});
