import { copyFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const assets = [
  'index.html', 'login.html', 'signup.html', 'inquiry.html',
  'style.css', 'auth.css', 'inquiry.css',
  'script.js', 'auth.js', 'inquiry.js',
  'robots.txt', 'sitemap.xml',
];

mkdirSync(output, { recursive: true });
for (const asset of assets) {
  copyFileSync(new URL(asset, root), new URL(asset, output));
}
