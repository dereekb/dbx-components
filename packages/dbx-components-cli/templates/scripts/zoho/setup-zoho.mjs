#!/usr/bin/env node
// Scaffold a Zoho integration into a dbx-components project.
//
// Reads dbx.setup.json (written by setup-project.sh) for project naming,
// prompts for which Zoho products to wire up, and renders templates from
// ./templates/ into apps/<api>/src/app/api/zoho/.
//
// Usage:
//   node scripts/zoho/setup-zoho.mjs                       (interactive)
//   node scripts/zoho/setup-zoho.mjs --products=recruit,sign --yes
//
// Supported products: recruit, crm, sign

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readDbxSetup } from '../_lib/setup-config.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(SCRIPT_DIR, 'templates');
const SUPPORTED_PRODUCTS = ['recruit', 'crm', 'sign'];

// MARK: CLI args
function parseArgs(argv) {
  const args = { products: null, yes: false };

  for (const raw of argv.slice(2)) {
    if (raw === '--yes' || raw === '-y') {
      args.yes = true;
    } else if (raw.startsWith('--products=')) {
      args.products = raw
        .slice('--products='.length)
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
    } else {
      throw new Error(`Unknown arg: ${raw}`);
    }
  }

  return args;
}

function validateProducts(products) {
  const invalid = products.filter((p) => !SUPPORTED_PRODUCTS.includes(p));

  if (invalid.length > 0) {
    throw new Error(`Unsupported products: ${invalid.join(', ')}. Supported: ${SUPPORTED_PRODUCTS.join(', ')}`);
  }

  if (products.length === 0) {
    throw new Error('No products selected. Pick at least one of: ' + SUPPORTED_PRODUCTS.join(', '));
  }

  return products;
}

// MARK: Interactive prompt
async function promptProducts() {
  const rl = createInterface({ input: stdin, output: stdout });
  let result = null;

  try {
    console.log('\nWhich Zoho products do you want to wire up?');
    SUPPORTED_PRODUCTS.forEach((p, i) => console.log(`  ${i + 1}) ${p}`));
    const answer = await rl.question('Enter comma-separated names or numbers (e.g. "recruit,sign" or "1,3"): ');

    result = answer
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .map((s) => {
        const asNum = Number.parseInt(s, 10);
        return Number.isInteger(asNum) && asNum >= 1 && asNum <= SUPPORTED_PRODUCTS.length ? SUPPORTED_PRODUCTS[asNum - 1] : s;
      })
      .filter(Boolean);
  } finally {
    rl.close();
  }

  return result;
}

async function promptConfirm(message) {
  const rl = createInterface({ input: stdin, output: stdout });
  let confirmed = false;

  try {
    const answer = await rl.question(`${message} [y/N]: `);
    confirmed = /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }

  return confirmed;
}

// MARK: Template processing
function applyConditionalBlocks(text, products) {
  const lines = text.split('\n');
  const out = [];
  let skipDepth = 0;

  for (const line of lines) {
    const ifMatch = line.match(/^\s*\/\/#if\s+(\w+)\s*$/);
    const endifMatch = line.match(/^\s*\/\/#endif\s*$/);

    if (ifMatch) {
      const product = ifMatch[1];

      if (skipDepth > 0 || !products.includes(product)) {
        skipDepth += 1;
      }
    } else if (endifMatch) {
      if (skipDepth > 0) {
        skipDepth -= 1;
      }
    } else if (skipDepth === 0) {
      out.push(line);
    }
  }

  return out.join('\n');
}

function substituteTokens(text, tokens) {
  let result = text;

  for (const [key, value] of Object.entries(tokens)) {
    result = result.split(key).join(value);
  }

  return result;
}

function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, '\n\n');
}

async function renderTemplate(templateName, products, tokens) {
  const path = join(TEMPLATES_DIR, templateName);
  const raw = await readFile(path, 'utf8');
  const filtered = applyConditionalBlocks(raw, products);
  const substituted = substituteTokens(filtered, tokens);
  return collapseBlankLines(substituted);
}

// MARK: api.module.ts patching
function importPathFor(className) {
  return className.endsWith('SignWebhookModule') ? './zoho/zoho.sign.webhook.module' : './zoho/zoho.module';
}

async function patchApiModule(apiModulePath, classNames) {
  const original = await readFile(apiModulePath, 'utf8');
  const missing = classNames.filter((name) => !original.includes(`import { ${name} }`));
  const lines = original.split('\n');
  const lastImportIdx = lines.reduce((acc, line, idx) => (line.startsWith('import ') ? idx : acc), -1);

  if (lastImportIdx === -1) {
    throw new Error(`No import statements found in ${apiModulePath}.`);
  }

  const newImportLines = missing.map((name) => `import { ${name} } from '${importPathFor(name)}';`);
  const withImports = [...lines.slice(0, lastImportIdx + 1), ...newImportLines, ...lines.slice(lastImportIdx + 1)].join('\n');

  // Inject into imports: [...] array of @Module decorator
  const updated = withImports.replace(/imports:\s*\[([^\]]*)\]/, (match, inner) => {
    const trimmed = inner.trim();
    const additions = classNames.filter((name) => !inner.includes(name)).join(', ');

    if (additions.length === 0) {
      return match;
    }

    return trimmed.length === 0 ? `imports: [${additions}]` : `imports: [${trimmed}, ${additions}]`;
  });

  if (updated === original) {
    return { changed: false, reason: 'no changes needed' };
  }

  await writeFile(apiModulePath, updated, 'utf8');
  return { changed: true };
}

// MARK: env file patching
async function appendEnvVars(envPath, envBlock) {
  if (!existsSync(envPath)) {
    return { changed: false, reason: 'file does not exist' };
  }

  const original = await readFile(envPath, 'utf8');

  if (original.includes('ZOHO_ACCOUNTS_URL=')) {
    return { changed: false, reason: 'already contains ZOHO_ACCOUNTS_URL' };
  }

  const separator = original.endsWith('\n') ? '' : '\n';
  await writeFile(envPath, original + separator + envBlock, 'utf8');
  return { changed: true };
}

// MARK: Main
async function main() {
  const args = parseArgs(process.argv);
  const config = await readDbxSetup();
  const products = validateProducts(args.products ?? (await promptProducts()));

  const tokens = {
    __APP_PASCAL__: config.appCodePrefix.pascal,
    __APP_CAMEL__: config.appCodePrefix.camel,
    __FIREBASE_COMPONENTS__: config.components.firebase
  };

  const apiAppName = config.apps.api;
  const zohoDir = join(config.projectRoot, 'apps', apiAppName, 'src', 'app', 'api', 'zoho');
  const apiModulePath = join(config.projectRoot, 'apps', apiAppName, 'src', 'app', 'api', 'api.module.ts');

  // Plan files to write
  const filesToWrite = [
    { tmpl: 'zoho.module.ts.tmpl', out: 'zoho.module.ts' },
    { tmpl: 'zoho.service.ts.tmpl', out: 'zoho.service.ts' }
  ];

  if (products.includes('recruit')) {
    filesToWrite.push({ tmpl: 'zoho.recruit.service.ts.tmpl', out: 'zoho.recruit.service.ts' });
  }
  if (products.includes('crm')) {
    filesToWrite.push({ tmpl: 'zoho.crm.service.ts.tmpl', out: 'zoho.crm.service.ts' });
  }
  if (products.includes('sign')) {
    filesToWrite.push({ tmpl: 'zoho.sign.service.ts.tmpl', out: 'zoho.sign.service.ts' }, { tmpl: 'zoho.sign.webhook.module.ts.tmpl', out: 'zoho.sign.webhook.module.ts' });
  }

  // Show plan
  console.log('\nProject:', config.projectName);
  console.log('Prefix:', config.appCodePrefix.pascal, '/', config.appCodePrefix.camel);
  console.log('API app:', apiAppName);
  console.log('Products:', products.join(', '));
  console.log('\nWill write:');
  filesToWrite.forEach((f) => console.log(`  + ${join(zohoDir, f.out)}`));
  console.log(`\nWill patch:\n  ~ ${apiModulePath}`);
  console.log('\nWill append ZOHO_* env vars to (if present):');
  ['.env', '.env.staging', '.env.prod'].forEach((e) => console.log(`  ~ ${join(config.projectRoot, e)}`));

  const confirmed = args.yes || (await promptConfirm('\nProceed?'));

  if (!confirmed) {
    console.log('Aborted.');
    return;
  }

  // Refuse to clobber
  await mkdir(zohoDir, { recursive: true });
  const existing = [];

  for (const { out } of filesToWrite) {
    const path = join(zohoDir, out);
    if (existsSync(path)) {
      existing.push(out);
    }
  }

  if (existing.length > 0) {
    throw new Error(`Refusing to overwrite existing files in ${zohoDir}: ${existing.join(', ')}. Remove them first to re-run.`);
  }

  // Render & write
  for (const { tmpl, out } of filesToWrite) {
    const content = await renderTemplate(tmpl, products, tokens);
    await writeFile(join(zohoDir, out), content, 'utf8');
    console.log(`  wrote ${out}`);
  }

  // Patch api.module.ts
  const moduleClasses = [`${tokens.__APP_PASCAL__}ApiZohoModule`];

  if (products.includes('sign')) {
    moduleClasses.push(`${tokens.__APP_PASCAL__}ApiZohoSignWebhookModule`);
  }

  const apiResult = await patchApiModule(apiModulePath, moduleClasses);
  console.log(apiResult.changed ? `  patched api.module.ts` : `  api.module.ts unchanged (${apiResult.reason})`);

  // Append env vars
  const envBlock = await renderTemplate('env.tmpl', products, tokens);

  for (const envFile of ['.env', '.env.staging', '.env.prod']) {
    const path = join(config.projectRoot, envFile);
    const result = await appendEnvVars(path, envBlock);
    console.log(result.changed ? `  appended to ${envFile}` : `  ${envFile} unchanged (${result.reason})`);
  }

  console.log('\nDone. Next steps:');
  console.log('  1. Fill in the ZOHO_* placeholders in your .env files with real OAuth credentials.');
  console.log(`  2. Run \`pnpm nx build ${apiAppName}\` to verify the generated code compiles.`);
  console.log('  3. If you selected Sign, configure the webhook URL in your Zoho Sign console.');
}

try {
  await main();
} catch (err) {
  console.error('\n[setup-zoho] Error:', err.message);
  process.exit(1);
}
