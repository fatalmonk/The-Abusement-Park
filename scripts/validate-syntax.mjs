import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());
const localScripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => !/^(?:https?:)?\/\//.test(source));

if (!inlineScripts.length && !localScripts.length) throw new Error('No application script found in index.html');
for (const [index, source] of inlineScripts.entries()) {
  new vm.Script(source, { filename: `index.html:inline-script-${index + 1}.js` });
}
for (const source of localScripts) {
  const scriptUrl = new URL(`../public/${source}`, import.meta.url);
  await access(scriptUrl);
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(scriptUrl)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `Syntax validation failed for ${source}`);
}

console.log(`Validated ${inlineScripts.length} inline and ${localScripts.length} local script(s).`);
