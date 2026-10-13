/**
 * Generates `docs.manifest.json` for an API app's audience-gated docs folder.
 *
 * Pipeline (build-time, run via `nx run <app-api>:generate-docs-manifest`):
 *
 *   1. Walk the SOURCE docs folder (e.g. `apps/<app>-api/src/assets/docs`). A non-`.md` file, a dotfile, or a symlink
 *      that escapes the folder is an error.
 *   2. Parse each doc's frontmatter (`title`, `description`, `tags`, `audience`) and its H2/H3 sections, and hash
 *      its bytes (`sha256` + `size`). A doc without an audience (and no `--default-audience`) or with an audience
 *      outside `--audiences` is an error. `any` is reserved: any authenticated caller.
 *   3. Write the manifest to `<output>.tmp`, then rename it to `<output>` so partial files never land on disk.
 *
 * Write the manifest next to `mcp.manifest.json` (`dist/apps/<app>-api/docs.manifest.json`), never under
 * `dist/.../assets/`, which `build-base` owns. The `@dereekb/firebase-server` docs API reads it at runtime, and
 * refuses any doc whose bytes no longer match the manifest.
 *
 * Errors fail generation (exit 1) and delete any manifest an earlier, passing run left behind. `--strict` promotes
 * warnings (unknown frontmatter keys, a missing title) to errors.
 *
 * Flags:
 *   --docs-dir=<path>            (required) the docs folder (workspace-relative or absolute).
 *   --output=<path>              (required) destination JSON path.
 *   --audiences=<a,b>            (required) the audience allow-list, recorded in the manifest. `any` is implied.
 *   --app=<name>                 (optional) app name stamped onto the manifest; defaults to the basename of the
 *                                --output directory.
 *   --default-audience=<a,b>     (optional) audience for docs without an `audience` frontmatter key.
 *   --strict                     (optional) promote all warnings to errors.
 *   --allow-empty                (optional) allow a folder with no docs (an empty manifest keeps the docs tool hidden).
 */

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { countDocsManifestGenerationErrors, formatDocsManifestFinding, renderDocsManifest } from './render';

interface Flags {
  readonly docsDir: string | undefined;
  readonly output: string | undefined;
  readonly app: string | undefined;
  readonly audiences: readonly string[] | undefined;
  readonly defaultAudience: readonly string[] | undefined;
  readonly strict: boolean;
  readonly allowEmpty: boolean;
}

const WORKSPACE_ROOT = process.cwd();

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.docsDir == null || flags.output == null || flags.audiences == null || flags.audiences.length === 0) {
    printUsageAndExit();
    return;
  }

  const docsPath = resolveWorkspacePath(flags.docsDir);
  const outputPath = resolveWorkspacePath(flags.output);

  if (!existsSync(docsPath)) {
    await rm(outputPath, { force: true });
    console.error(`generate-docs-manifest: docs folder ${toDisplayPath(docsPath)} does not exist; not writing ${toDisplayPath(outputPath)}.`);
    process.exit(1);
  }

  const app = flags.app ?? basename(dirname(outputPath));
  const { manifest, findings } = await renderDocsManifest({ docsDir: docsPath, app, audiences: flags.audiences, defaultAudience: flags.defaultAudience, allowEmpty: flags.allowEmpty });

  for (const finding of findings) {
    console.error(formatDocsManifestFinding(finding));
  }

  const blockingCount = countDocsManifestGenerationErrors({ findings, strict: flags.strict });

  if (blockingCount > 0) {
    await rm(outputPath, { force: true });
    console.error(`generate-docs-manifest: ${blockingCount} blocking issue(s)${flags.strict ? ' (--strict)' : ''}; not writing ${toDisplayPath(outputPath)}.`);
    process.exit(1);
  }

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const outputDir = dirname(outputPath);

  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, serialized);
  await rename(tmpPath, outputPath);

  console.log(`[wrote] ${toDisplayPath(outputPath)} — ${manifest.docs.length} doc(s), audiences: ${manifest.audiences.join(', ')}, ${findings.length} warning(s)`);
}

function resolveWorkspacePath(value: string): string {
  return isAbsolute(value) ? value : resolve(WORKSPACE_ROOT, value);
}

function toDisplayPath(absolutePath: string): string {
  const rel = relative(WORKSPACE_ROOT, absolutePath);
  const display = rel.startsWith('..') || isAbsolute(rel) ? absolutePath : rel;
  return display.split(sep).join('/');
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function parseFlags(argv: readonly string[]): Flags {
  let docsDir: string | undefined;
  let output: string | undefined;
  let app: string | undefined;
  let audiences: string[] | undefined;
  let defaultAudience: string[] | undefined;
  let strict = false;
  let allowEmpty = false;

  for (const arg of argv) {
    if (arg.startsWith('--docs-dir=')) {
      docsDir = arg.slice('--docs-dir='.length);
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    } else if (arg.startsWith('--app=')) {
      app = arg.slice('--app='.length);
    } else if (arg.startsWith('--audiences=')) {
      audiences = parseList(arg.slice('--audiences='.length));
    } else if (arg.startsWith('--default-audience=')) {
      defaultAudience = parseList(arg.slice('--default-audience='.length));
    } else if (arg === '--strict') {
      strict = true;
    } else if (arg === '--allow-empty') {
      allowEmpty = true;
    }
  }

  return { docsDir, output, app, audiences, defaultAudience, strict, allowEmpty };
}

function printUsageAndExit(): void {
  console.error(String.raw`generate-docs-manifest

Usage:
  node dist/packages/dbx-cli/generate-docs-manifest/main.js \
    --docs-dir=apps/demo-api/src/assets/docs \
    --output=dist/apps/demo-api/docs.manifest.json \
    --app=demo-api \
    --audiences=admin,user

Required flags:
  --docs-dir=<path>            The docs folder (workspace-relative or absolute). Markdown only.
  --output=<path>              Path to the docs manifest JSON to write. Keep it OUT of dist/.../assets/.
  --audiences=<a,b>            The audience allow-list. "any" (any authenticated caller) is implied.

Optional:
  --app=<name>                 App name stamped onto the manifest (default: the output directory name).
  --default-audience=<a,b>     Audience for docs without an "audience" frontmatter key (no implicit default).
  --strict                     Promote all warnings to errors.
  --allow-empty                Allow a folder with no docs yet.

Errors always fail generation (exit 1) and remove any existing output file.`);
  process.exit(1);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
