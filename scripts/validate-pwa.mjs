import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const manifest = JSON.parse(read('public/manifest.webmanifest'));
assert(manifest.name && manifest.short_name, 'Manifest must declare application names.');
assert(manifest.display === 'standalone', 'Manifest must use standalone display mode.');
assert(manifest.start_url === '/', 'Manifest must start at the application root.');
assert(Array.isArray(manifest.icons) && manifest.icons.some((icon) => icon.sizes === '192x192'), 'Manifest must include a 192x192 icon.');
assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose?.includes('maskable')), 'Manifest must include a maskable 512x512 icon.');
for (const icon of manifest.icons) assert(fs.existsSync(path.join(root, 'public', icon.src)), `Manifest icon missing: ${icon.src}`);

const html = read('index.html');
assert(html.includes('rel="manifest"'), 'Document must link the web manifest.');
assert(html.includes('apple-mobile-web-app-capable'), 'Document must declare mobile installability metadata.');

const worker = read('public/sw.js');
assert(worker.includes('CACHE_NAME') && /faithhaven-public-v\d+/.test(worker), 'Service worker must use a versioned cache name.');
assert(worker.includes("url.pathname.startsWith('/api/')"), 'Service worker must bypass API requests.');
assert(worker.includes("url.pathname.includes('payfast')") || worker.includes("url.pathname.startsWith('/api/payments/") || worker.includes("url.pathname.startsWith('/api/')"), 'Service worker must not cache payment requests.');
assert(worker.includes('offline.html'), 'Service worker must provide an offline navigation fallback.');
assert(fs.existsSync(path.join(root, 'public', 'offline.html')), 'Offline fallback document is missing.');

console.log('PWA validation passed.');
