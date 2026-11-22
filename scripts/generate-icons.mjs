// Gera os ícones PNG da PWA a partir de public/icons/icon.svg
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const svg = readFileSync(join(root, 'icon.svg'));

const sizes = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];
for (const [name, size] of sizes) {
  await sharp(svg).resize(size, size).png().toFile(join(root, name));
}

// Ícone "maskable": conteúdo na área segura (80%) sobre fundo laranja sólido.
const inner = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#f97316' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(join(root, 'icon-maskable-512.png'));

console.log('Ícones gerados em', root);
