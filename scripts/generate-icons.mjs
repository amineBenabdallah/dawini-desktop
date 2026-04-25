import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '../resources/icons/icon.svg');
const outDir = path.join(__dirname, '../resources/icons');
const svgBuffer = fs.readFileSync(svgPath);

async function generatePng(size, outPath) {
  await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
  console.log(`Generated: ${outPath}`);
}

// ICO format writer: single 256x256 image inside an ICO container
async function generateIco(pngPath, icoPath) {
  const pngData = fs.readFileSync(pngPath);
  const size = pngData.length;

  // ICO header (6 bytes) + 1 image directory entry (16 bytes) + PNG data
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // Reserved
  header.writeUInt16LE(1, 2);  // Type: 1 = ICO
  header.writeUInt16LE(1, 4);  // Number of images

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);          // Width: 0 = 256
  entry.writeUInt8(0, 1);          // Height: 0 = 256
  entry.writeUInt8(0, 2);          // Color count
  entry.writeUInt8(0, 3);          // Reserved
  entry.writeUInt16LE(1, 4);       // Color planes
  entry.writeUInt16LE(32, 6);      // Bits per pixel
  entry.writeUInt32LE(size, 8);    // Size of PNG data
  entry.writeUInt32LE(22, 12);     // Offset = 6 (header) + 16 (entry)

  const ico = Buffer.concat([header, entry, pngData]);
  fs.writeFileSync(icoPath, ico);
  console.log(`Generated: ${icoPath}`);
}

const png512 = path.join(outDir, 'icon.png');
const png256 = path.join(outDir, 'icon-256.png');
const icoPath = path.join(outDir, 'icon.ico');

await generatePng(512, png512);
await generatePng(256, png256);
await generateIco(png256, icoPath);
fs.unlinkSync(png256);

console.log('All icons generated successfully.');
