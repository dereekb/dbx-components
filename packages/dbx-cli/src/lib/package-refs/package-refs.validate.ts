import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseDocsFrontmatter } from '../docs/docs-frontmatter';
import { DBX_CLAUDE_PACKAGE_JSON_KEY, type EmbeddedPackageRefs, PACKAGE_REF_NAME_REGEX, PACKAGE_REF_REJECTED_KEYS, PACKAGE_REF_ROOT_FILENAME, PACKAGE_REF_SUBDOC_DIR, PACKAGE_REFS_DIR } from './package-refs';

/**
 * The keys a `dbxClaude.refs` entry may set.
 */
const PACKAGE_REF_ALLOWED_KEYS = new Set(['name', 'triggers']);

/**
 * The rollup config file the refs asset entry is looked for in.
 */
export const PACKAGE_REFS_ROLLUP_CONFIG_FILENAME = 'rollup.config.cjs';

/**
 * Codes of the findings {@link validatePackageRefs} reports.
 */
export type PackageRefsFindingCode =
  | 'PACKAGE_JSON_UNREADABLE'
  | 'DECLARATION_INVALID'
  | 'REF_ENTRY_INVALID'
  | 'REF_NAME_INVALID'
  | 'REF_NAME_DUPLICATE'
  | 'REF_KEY_REJECTED'
  | 'REF_KEY_UNKNOWN'
  | 'REF_TRIGGERS_INVALID'
  | 'REF_DOC_MISSING'
  | 'REF_FRONTMATTER_NAME_MISMATCH'
  | 'REF_DESCRIPTION_MISSING'
  | 'REF_DIR_UNDECLARED'
  | 'SUBDOC_INVALID'
  | 'SUBDOC_NOT_LISTED'
  | 'ROLLUP_ASSET_MISSING'
  | 'EMBEDDED_PACKAGE_NAME_MISMATCH'
  | 'EMBEDDED_REF_MISMATCH'
  | 'EMBEDDED_DOC_MISMATCH'
  | 'EMBEDDED_CONTENT_MISMATCH';

/**
 * One problem with a package's shipped refs.
 */
export interface PackageRefsFinding {
  readonly code: PackageRefsFindingCode;
  readonly message: string;
  /**
   * The file or folder at fault, relative to the package root.
   */
  readonly path?: string;
}

/**
 * Configuration for {@link validatePackageRefs}.
 */
export interface ValidatePackageRefsConfig {
  /**
   * The package's source folder, holding its `package.json`, `refs/` and `rollup.config.cjs`.
   */
  readonly packageRoot: string;
  /**
   * The refs the package's CLI embeds. When given, they must match the files on disk exactly.
   */
  readonly embedded?: EmbeddedPackageRefs;
}

interface PackageRefsFiles {
  readonly content: string;
  readonly docs: ReadonlyMap<string, string>;
}

/**
 * Checks that a package's declared dbx-claude refs are shipped and parse.
 *
 * 1. `package.json` `dbxClaude` is an object whose `refs` is an array of `{ name, triggers? }` entries with valid,
 *    unique names, no rejected keys (`id`, `path`, `source`, `delivery`, `tone`, …) and non-empty trigger objects.
 * 2. Each `refs/<name>/REF.md` exists, and its frontmatter `name` equals `<name>` and `description` is set.
 * 3. Every folder under `refs/` is declared, and each `references/` folder holds only flat `<doc>.md` files.
 * 4. REF.md mentions every sub-doc key.
 * 5. `rollup.config.cjs` copies `packages/<pkg>/refs` to `refs`.
 * 6. When `embedded` is given, its package name, refs, sub-doc keys and contents equal the files on disk.
 *
 * Trigger contents are not checked here: dbx-claude owns that schema and its doctor reports on it.
 *
 * @param config - The package root and, for a CLI, its embedded refs.
 * @returns The findings; empty when the package is clean or declares no refs.
 */
export function validatePackageRefs(config: ValidatePackageRefsConfig): PackageRefsFinding[] {
  const packageRoot = resolve(config.packageRoot);
  const findings: PackageRefsFinding[] = [];
  const packageJson = readPackageJson(packageRoot, findings);
  const names = packageJson == null ? [] : readDeclaredRefNames(packageJson, findings);
  const files = new Map<string, PackageRefsFiles>();

  names.forEach((name) => {
    const refFiles = readRefFiles(packageRoot, name, findings);

    if (refFiles != null) {
      files.set(name, refFiles);
    }
  });

  findUndeclaredRefDirs(packageRoot, new Set(names), findings);

  if (names.length > 0) {
    checkRollupAsset(packageRoot, findings);
  }

  if (config.embedded != null && packageJson != null) {
    checkEmbedded({ embedded: config.embedded, packageJson, packageRoot, files }, findings);
  }

  return findings;
}

function readPackageJson(packageRoot: string, findings: PackageRefsFinding[]): Record<string, unknown> | undefined {
  let result: Record<string, unknown> | undefined;

  try {
    const parsed: unknown = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

    if (isPlainObject(parsed)) {
      result = parsed;
    } else {
      findings.push({ code: 'PACKAGE_JSON_UNREADABLE', message: 'package.json is not a JSON object.', path: 'package.json' });
    }
  } catch (e) {
    findings.push({ code: 'PACKAGE_JSON_UNREADABLE', message: `package.json could not be read: ${(e as Error).message}`, path: 'package.json' });
  }

  return result;
}

function readDeclaredRefNames(packageJson: Record<string, unknown>, findings: PackageRefsFinding[]): string[] {
  const declaration = packageJson[DBX_CLAUDE_PACKAGE_JSON_KEY];
  const names: string[] = [];

  if (declaration == null) {
    // nothing declared
  } else if (!isPlainObject(declaration)) {
    findings.push({ code: 'DECLARATION_INVALID', message: `package.json "${DBX_CLAUDE_PACKAGE_JSON_KEY}" must be an object.`, path: 'package.json' });
  } else if (declaration['refs'] != null && !Array.isArray(declaration['refs'])) {
    findings.push({ code: 'DECLARATION_INVALID', message: `package.json "${DBX_CLAUDE_PACKAGE_JSON_KEY}.refs" must be an array.`, path: 'package.json' });
  } else {
    ((declaration['refs'] as unknown[] | undefined) ?? []).forEach((entry, i) => {
      const name = readDeclaredRef(entry, i, findings);

      if (name == null) {
        // already reported
      } else if (names.includes(name)) {
        findings.push({ code: 'REF_NAME_DUPLICATE', message: `Ref "${name}" is declared more than once.`, path: 'package.json' });
      } else {
        names.push(name);
      }
    });
  }

  return names;
}

function readDeclaredRef(entry: unknown, index: number, findings: PackageRefsFinding[]): string | undefined {
  const label = `${DBX_CLAUDE_PACKAGE_JSON_KEY}.refs[${index}]`;
  let result: string | undefined;

  if (isPlainObject(entry)) {
    const name = entry['name'];

    Object.keys(entry).forEach((key) => {
      if (PACKAGE_REF_REJECTED_KEYS.includes(key)) {
        findings.push({ code: 'REF_KEY_REJECTED', message: `${label} sets "${key}", which a package may not set: dbx-claude delivers package refs as read hints, and a consuming project escalates through its own config.`, path: 'package.json' });
      } else if (!PACKAGE_REF_ALLOWED_KEYS.has(key)) {
        findings.push({ code: 'REF_KEY_UNKNOWN', message: `${label} sets unknown key "${key}". Only "name" and "triggers" are allowed.`, path: 'package.json' });
      }
    });

    const triggers = entry['triggers'];
    const triggersValid = triggers == null || (Array.isArray(triggers) && triggers.every((x) => isPlainObject(x) && Object.keys(x).length > 0));

    if (!triggersValid) {
      findings.push({ code: 'REF_TRIGGERS_INVALID', message: `${label}.triggers must be an array of non-empty objects.`, path: 'package.json' });
    }

    if (typeof name === 'string' && PACKAGE_REF_NAME_REGEX.test(name)) {
      result = name;
    } else {
      findings.push({ code: 'REF_NAME_INVALID', message: `${label}.name must match ${PACKAGE_REF_NAME_REGEX.source}.`, path: 'package.json' });
    }
  } else {
    findings.push({ code: 'REF_ENTRY_INVALID', message: `${label} must be an object.`, path: 'package.json' });
  }

  return result;
}

function readRefFiles(packageRoot: string, name: string, findings: PackageRefsFinding[]): PackageRefsFiles | undefined {
  const refDirPath = `${PACKAGE_REFS_DIR}/${name}`;
  const rootDocPath = `${refDirPath}/${PACKAGE_REF_ROOT_FILENAME}`;
  const rootDocFile = join(packageRoot, rootDocPath);
  let result: PackageRefsFiles | undefined;

  if (existsSync(rootDocFile)) {
    const content = readFileSync(rootDocFile, 'utf8');
    const { values } = parseDocsFrontmatter(content);
    const description = values['description'];

    if (values['name'] !== name) {
      findings.push({ code: 'REF_FRONTMATTER_NAME_MISMATCH', message: `${rootDocPath} frontmatter "name" must be "${name}".`, path: rootDocPath });
    }

    if (typeof description !== 'string' || description.trim().length === 0) {
      findings.push({ code: 'REF_DESCRIPTION_MISSING', message: `${rootDocPath} frontmatter needs a non-empty "description".`, path: rootDocPath });
    }

    const docs = readRefSubDocs(packageRoot, refDirPath, findings);

    docs.forEach((_, doc) => {
      if (!content.includes(doc)) {
        findings.push({ code: 'SUBDOC_NOT_LISTED', message: `${rootDocPath} does not mention its sub-doc "${doc}". List every sub-doc key in REF.md.`, path: rootDocPath });
      }
    });

    result = { content, docs };
  } else {
    findings.push({ code: 'REF_DOC_MISSING', message: `Declared ref "${name}" has no ${rootDocPath}.`, path: rootDocPath });
  }

  return result;
}

function readRefSubDocs(packageRoot: string, refDirPath: string, findings: PackageRefsFinding[]): Map<string, string> {
  const subDocDirPath = `${refDirPath}/${PACKAGE_REF_SUBDOC_DIR}`;
  const subDocDir = join(packageRoot, subDocDirPath);
  const docs = new Map<string, string>();

  if (existsSync(subDocDir)) {
    readdirSync(subDocDir, { withFileTypes: true }).forEach((entry) => {
      const entryPath = `${subDocDirPath}/${entry.name}`;
      const key = entry.name.endsWith('.md') ? entry.name.slice(0, -'.md'.length) : undefined;

      if (!entry.isFile() || key == null || !PACKAGE_REF_NAME_REGEX.test(key)) {
        findings.push({ code: 'SUBDOC_INVALID', message: `${entryPath} is not a sub-doc. ${PACKAGE_REF_SUBDOC_DIR}/ holds only flat <doc>.md files whose <doc> matches ${PACKAGE_REF_NAME_REGEX.source}.`, path: entryPath });
      } else {
        docs.set(key, readFileSync(join(subDocDir, entry.name), 'utf8'));
      }
    });
  }

  return docs;
}

function findUndeclaredRefDirs(packageRoot: string, declared: ReadonlySet<string>, findings: PackageRefsFinding[]): void {
  const refsDir = join(packageRoot, PACKAGE_REFS_DIR);

  if (existsSync(refsDir)) {
    readdirSync(refsDir, { withFileTypes: true })
      .filter((x) => !declared.has(x.name))
      .forEach((entry) => {
        const entryPath = `${PACKAGE_REFS_DIR}/${entry.name}`;
        findings.push({ code: 'REF_DIR_UNDECLARED', message: `${entryPath} is not declared in package.json "${DBX_CLAUDE_PACKAGE_JSON_KEY}.refs".`, path: entryPath });
      });
  }
}

function checkRollupAsset(packageRoot: string, findings: PackageRefsFinding[]): void {
  const rollupFile = join(packageRoot, PACKAGE_REFS_ROLLUP_CONFIG_FILENAME);
  const workspaceRoot = findWorkspaceRoot(packageRoot);
  const packagePath = workspaceRoot == null ? undefined : relative(workspaceRoot, packageRoot).split(sep).join('/');
  const expectedInput = `${packagePath ?? '<pkg>'}/${PACKAGE_REFS_DIR}`;
  const expectedEntry = `{ glob: '**/*.md', input: '${expectedInput}', output: '${PACKAGE_REFS_DIR}' }`;
  let found = false;

  if (packagePath != null && existsSync(rollupFile)) {
    const text = readFileSync(rollupFile, 'utf8');
    const objects = text.match(/\{[^{}]*\}/g) ?? [];
    const inputRegex = new RegExp(String.raw`input\s*:\s*['"\x60]${escapeRegex(expectedInput)}/?['"\x60]`);
    const outputRegex = new RegExp(String.raw`output\s*:\s*['"\x60]\.?/?${PACKAGE_REFS_DIR}/?['"\x60]`);
    found = objects.some((x) => inputRegex.test(x) && outputRegex.test(x));
  }

  if (!found) {
    findings.push({ code: 'ROLLUP_ASSET_MISSING', message: `${PACKAGE_REFS_ROLLUP_CONFIG_FILENAME} does not copy the refs into the published package. Add to its assets: ${expectedEntry}`, path: PACKAGE_REFS_ROLLUP_CONFIG_FILENAME });
  }
}

interface CheckEmbeddedInput {
  readonly embedded: EmbeddedPackageRefs;
  readonly packageJson: Record<string, unknown>;
  readonly packageRoot: string;
  readonly files: ReadonlyMap<string, PackageRefsFiles>;
}

function checkEmbedded(input: CheckEmbeddedInput, findings: PackageRefsFinding[]): void {
  const { embedded, packageJson, packageRoot, files } = input;
  const refsDir = join(packageRoot, PACKAGE_REFS_DIR);
  const onDisk = existsSync(refsDir) ? new Set(readdirSync(refsDir, { withFileTypes: true }).map((x) => x.name)) : new Set<string>();
  const embeddedNames = new Set(embedded.refs.map((x) => x.name));

  if (embedded.packageName !== packageJson['name']) {
    findings.push({ code: 'EMBEDDED_PACKAGE_NAME_MISMATCH', message: `The embedded refs name package "${embedded.packageName}", but package.json is "${String(packageJson['name'])}".`, path: 'package.json' });
  }

  Array.from(onDisk)
    .filter((x) => !embeddedNames.has(x))
    .forEach((name) => findings.push({ code: 'EMBEDDED_REF_MISMATCH', message: `Ref "${name}" is on disk but not embedded. Import its REF.md with ?raw.`, path: `${PACKAGE_REFS_DIR}/${name}` }));
  Array.from(embeddedNames)
    .filter((x) => !onDisk.has(x))
    .forEach((name) => findings.push({ code: 'EMBEDDED_REF_MISMATCH', message: `Ref "${name}" is embedded but has no folder under ${PACKAGE_REFS_DIR}/.`, path: `${PACKAGE_REFS_DIR}/${name}` }));

  embedded.refs.forEach((ref) => {
    const refFiles = files.get(ref.name);
    const refDirPath = `${PACKAGE_REFS_DIR}/${ref.name}`;

    if (refFiles != null) {
      if (refFiles.content !== ref.content) {
        findings.push({ code: 'EMBEDDED_CONTENT_MISMATCH', message: `The embedded ${refDirPath}/${PACKAGE_REF_ROOT_FILENAME} differs from the file.`, path: `${refDirPath}/${PACKAGE_REF_ROOT_FILENAME}` });
      }

      const embeddedDocs = ref.docs ?? {};
      const diskKeys = Array.from(refFiles.docs.keys());
      const embeddedKeys = Object.keys(embeddedDocs);

      diskKeys.filter((x) => embeddedDocs[x] == null).forEach((doc) => findings.push({ code: 'EMBEDDED_DOC_MISMATCH', message: `Sub-doc "${ref.name}/${doc}" is on disk but not embedded. Import it with ?raw.`, path: `${refDirPath}/${PACKAGE_REF_SUBDOC_DIR}/${doc}.md` }));
      embeddedKeys.filter((x) => !refFiles.docs.has(x)).forEach((doc) => findings.push({ code: 'EMBEDDED_DOC_MISMATCH', message: `Sub-doc "${ref.name}/${doc}" is embedded but has no file.`, path: `${refDirPath}/${PACKAGE_REF_SUBDOC_DIR}/${doc}.md` }));
      embeddedKeys.filter((x) => refFiles.docs.has(x) && refFiles.docs.get(x) !== embeddedDocs[x]).forEach((doc) => findings.push({ code: 'EMBEDDED_CONTENT_MISMATCH', message: `The embedded sub-doc "${ref.name}/${doc}" differs from the file.`, path: `${refDirPath}/${PACKAGE_REF_SUBDOC_DIR}/${doc}.md` }));
    }
  });
}

function findWorkspaceRoot(from: string): string | undefined {
  let current = from;
  let result: string | undefined;

  while (result == null) {
    if (existsSync(join(current, 'nx.json'))) {
      result = current;
    } else {
      const parent = dirname(current);

      if (parent === current) {
        break;
      }

      current = parent;
    }
  }

  return result;
}

function escapeRegex(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
