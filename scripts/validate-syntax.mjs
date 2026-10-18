import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());

if (!scripts.length) throw new Error('No inline application script found in index.html');
for (const [index, source] of scripts.entries()) {
  new vm.Script(source, { filename: `index.html:inline-script-${index + 1}.js` });
}

console.log(`Validated ${scripts.length} inline script(s).`);
