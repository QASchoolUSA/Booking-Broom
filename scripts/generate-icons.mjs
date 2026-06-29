import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join } from "path";

const BRAND_BLUE = "#0284C7";
const OUT_DIR = join(process.cwd(), "public/icons");

async function createIcon(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.2) : Math.round(size * 0.15);
  const inner = size - padding * 2;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${maskable ? 0 : Math.round(size * 0.2)}" fill="${BRAND_BLUE}"/>
      <g transform="translate(${padding}, ${padding})">
        <rect x="${inner * 0.15}" y="${inner * 0.55}" width="${inner * 0.7}" height="${inner * 0.12}" rx="4" fill="white" opacity="0.95"/>
        <rect x="${inner * 0.35}" y="${inner * 0.2}" width="${inner * 0.3}" height="${inner * 0.45}" rx="6" fill="white" opacity="0.95"/>
        <circle cx="${inner * 0.5}" cy="${inner * 0.42}" r="${inner * 0.08}" fill="${BRAND_BLUE}"/>
      </g>
    </svg>
  `;

  const filename = maskable ? `icon-maskable-${size}.png` : `icon-${size}.png`;
  await sharp(Buffer.from(svg)).png().toFile(join(OUT_DIR, filename));
  console.log(`Created ${filename}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await createIcon(192);
  await createIcon(512);
  await createIcon(512, true);
}

main().catch(console.error);
