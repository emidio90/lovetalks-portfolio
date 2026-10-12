import {readdir, mkdir, readFile, writeFile, cp, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    if (entry.isDirectory()) files.push(...await walk(`${dir}/${entry.name}`));
    else files.push(`${dir}/${entry.name}`);
  }
  return files;
}
const paths = [...await walk('server'), ...await walk('public')].sort();
for (const file of paths.filter(file => /\.js$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', file], {stdio:'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
}
const html = await readFile('public/index.html', 'utf8');
for (const file of ['assets/css/styles.css', 'assets/js/app.js']) if (!html.includes(file)) throw new Error(`Missing HTML asset: ${file}`);
await rm('dist', {recursive:true, force:true});
await mkdir('dist', {recursive:true});
for (const dir of ['server','public']) await cp(dir, `dist/${dir}`, {recursive:true});
const manifest = {};
for (const file of paths) manifest[file] = createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile('dist/build-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built ${paths.length} source files into dist/; syntax and asset references checked.`);
