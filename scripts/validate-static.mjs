import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const required = ['<!DOCTYPE html>', '<title>', 'id="history"', 'id="standings"', 'id="live-widget-content"', 'role="dialog"'];
const failures = required.filter((needle) => !html.includes(needle)).map((needle) => `index.html missing ${needle}`);

for (const match of html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)) {
  const target = match[1];
  if (/^(?:https?:|mailto:|tel:|\/\/)/.test(target) || target.includes('${')) continue;
  if (!existsSync(resolve(root, target))) failures.push(`Missing local asset: ${target}`);
}

for (const file of ['_routes.json', 'wrangler.jsonc', 'functions/api/standings.js']) {
  if (!existsSync(resolve(root, file))) failures.push(`Missing required Cloudflare file: ${file}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Static application validation passed.');
}
