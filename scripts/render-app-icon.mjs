import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const outDir = path.resolve("public/brand");
fs.mkdirSync(outDir, { recursive: true });

// Solid square — preferred for TikTok / Meta / Google app icon uploads
const squareSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#183fe6"/>
  <path fill="#F4F1EA" d="M272 224h480v120H408v112h272v120H408v224H272V224z"/>
  <rect x="712" y="648" width="80" height="152" rx="14" fill="#F4F1EA" opacity="0.45"/>
  <rect x="824" y="544" width="80" height="256" rx="14" fill="#F4F1EA" opacity="0.75"/>
</svg>`;

const outPng = path.join(outDir, "formcraft-app-icon-1024.png");
const info = await sharp(Buffer.from(squareSvg))
  .flatten({ background: "#183fe6" })
  .png()
  .toFile(outPng);
console.log("Wrote", outPng, info);
