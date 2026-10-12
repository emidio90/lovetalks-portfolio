import {readdir, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const skip = new Set(['node_modules','dist','.git','test-results','playwright-report']);
const rules = [
  ['OpenAI-style credential', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/],
  ['GitHub-style credential', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
];
let count = 0;
const findings = [];
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    if (skip.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isSymbolicLink()) {findings.push(`${path}: symbolic link must be reviewed`); continue;}
    if (entry.isDirectory()) {await walk(path); continue;}
    count++;
    if (/^\.env(?:\..*)?$/.test(entry.name) && entry.name !== '.env.example') {findings.push(`${path}: private environment file (excluded from release)`); continue;}
    const text = await readFile(path, 'utf8');
    for (const [label, rule] of rules) if (rule.test(text)) findings.push(`${path}: ${label} (value redacted)`);
  }
}
await walk('.');
if (findings.length) {console.error(findings.join('\n')); process.exitCode = 1;}
else console.log(`Heuristic secret scan: ${count} files checked, no matching credential patterns. This is not a full security audit.`);
