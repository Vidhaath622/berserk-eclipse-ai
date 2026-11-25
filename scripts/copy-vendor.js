/**
 * Copies verified browser ES module vendor files from node_modules into public/vendor/
 * so static assets are served cleanly both locally and on Vercel's CDN (where express.static is ignored).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const copies = [
  {
    src: 'node_modules/three/build/three.module.js',
    dest: 'public/vendor/three/three.module.js'
  },
  {
    src: 'node_modules/three/build/three.core.js',
    dest: 'public/vendor/three/three.core.js'
  },
  {
    src: 'node_modules/marked/lib/marked.esm.js',
    dest: 'public/vendor/marked/marked.esm.js'
  },
  {
    src: 'node_modules/@highlightjs/cdn-assets/es/highlight.min.js',
    dest: 'public/vendor/hljs/es/highlight.min.js'
  }
];

for (const { src, dest } of copies) {
  const fullSrc = path.join(rootDir, src);
  const fullDest = path.join(rootDir, dest);

  if (!fs.existsSync(fullSrc)) {
    console.warn(`[copy-vendor] Source file not found yet: ${src}`);
    continue;
  }

  fs.mkdirSync(path.dirname(fullDest), { recursive: true });
  fs.copyFileSync(fullSrc, fullDest);
}

console.log('[copy-vendor] Synced Three.js, Marked, and Highlight.js ES modules into public/vendor/');
