#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function main() {
  const root = path.join(__dirname, '..');
  const srcSvg = path.join(root, 'public', 'favicon.svg');
  const outDir = path.join(root, 'build');
  await ensureDir(outDir);

  if (!fs.existsSync(srcSvg)) {
    console.error('favicon.svg not found at', srcSvg);
    process.exit(1);
  }

  const svgBuffer = await fs.promises.readFile(srcSvg);

  // Generate PNGs for ICO and a main PNG
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  const pngBuffers = [];
  for (const size of sizes) {
    const buf = await sharp(svgBuffer, { density: 512 })
      .resize(size, size, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const outPng = path.join(outDir, `icon-${size}.png`);
    await fs.promises.writeFile(outPng, buf);
    pngBuffers.push({ size, buf });
  }

  // Main app icon PNG (512x512)
  await fs.promises.writeFile(path.join(outDir, 'icon.png'), pngBuffers.find(p => p.size === 512).buf);

  // Build ICO from several sizes
  const ico = await pngToIco(pngBuffers.filter(p => p.size <= 256).map(p => p.buf));
  await fs.promises.writeFile(path.join(outDir, 'icon.ico'), ico);

  console.log('Icons generated in', outDir);
}

main().catch(err => { console.error(err); process.exit(1); });
