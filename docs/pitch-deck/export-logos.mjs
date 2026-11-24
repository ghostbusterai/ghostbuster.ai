import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(__dirname, "assets");

async function svgToPng(svgName, pngName, size) {
  const svgPath = path.join(assets, svgName);
  const outPath = path.join(assets, pngName);
  await sharp(svgPath).resize(size, size).png().toFile(outPath);
  console.log(`Wrote ${outPath}`);
}

await svgToPng("logo-mark.svg", "logo-mark-1024.png", 1024);
await svgToPng("logo-mark.svg", "logo-mark-512.png", 512);
await svgToPng("logo-mark.svg", "logo-mark-256.png", 256);
await svgToPng("logo-mark-light-bg.svg", "logo-mark-light-512.png", 512);

// Full horizontal lockup: render via composite in sharp
const lockupSvg = fs.readFileSync(path.join(assets, "logo-full-horizontal.svg"));
await sharp(lockupSvg).resize(1200).png().toFile(path.join(assets, "logo-full-horizontal-1200.png"));
console.log(`Wrote ${path.join(assets, "logo-full-horizontal-1200.png")}`);

const publicBrand = path.resolve(__dirname, "../../GhostBuster/public/brand");
if (fs.existsSync(publicBrand)) {
  const copies = [
    ["logo-mark.svg", "logo-mark.svg"],
    ["logo-full-horizontal.svg", "logo-full.svg"],
    ["logo-mark-512.png", "logo-mark.png"],
    ["logo-mark-1024.png", "logo-mark@2x.png"],
    ["logo-full-horizontal-1200.png", "logo-full.png"],
  ];
  for (const [src, dest] of copies) {
    fs.copyFileSync(path.join(assets, src), path.join(publicBrand, dest));
  }
  console.log(`Synced logos to ${publicBrand}`);
}
