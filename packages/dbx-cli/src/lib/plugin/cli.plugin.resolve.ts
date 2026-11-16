import { type Maybe } from '@dereekb/util';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Where a plugin reference came from, in load order.
 */
export type CliPluginSource = 'host' | 'config' | 'env' | 'flag';

/**
 * The extension arguments pre-scanned from argv before yargs is built.
 */
export interface CliExtensionArgs {
  /**
   * Every `--extension <ref>` / `--extension=<ref>`, in order.
   */
  readonly extensions: readonly string[];
  /**
   * `true` when `--no-extensions` was passed.
   */
  readonly noExtensions: boolean;
}

/**
 * Pre-scans argv for the repeatable `--extension` flag and `--no-extensions`, so plugins can be loaded (and their
 * commands registered) before yargs parses. Scanning stops at a bare `--`.
 *
 * @param argv - The raw arguments, without the node binary and script (i.e. `process.argv.slice(2)`).
 * @returns The extension references and the disable flag.
 */
export function prescanCliExtensionArgs(argv: readonly string[]): CliExtensionArgs {
  const extensions: string[] = [];
  let noExtensions = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--') {
      break;
    } else if (arg === '--no-extensions') {
      noExtensions = true;
    } else if (arg === '--extension' && argv[i + 1] != null) {
      extensions.push(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--extension=')) {
      extensions.push(arg.slice('--extension='.length));
    }
  }

  return { extensions, noExtensions };
}

/**
 * Whether a plugin reference is a package name rather than a path.
 *
 * A reference ending in a module extension (`plugin.mjs`) is always a path, so a bare file name passed to
 * `--extension` resolves against cwd as the user meant rather than as a package.
 *
 * @param ref - The reference.
 * @returns `true` for `name` / `@scope/name` (optionally with a subpath).
 */
export function isCliPluginPackageRef(ref: string): boolean {
  return !isAbsolute(ref) && !ref.startsWith('.') && !ref.startsWith('~') && !/\.[cm]?[jt]s$/.test(ref) && /^(@[\w.-]+\/)?[\w.-]+(\/.*)?$/.test(ref);
}

/**
 * Input for {@link resolveCliPluginRef}.
 */
export interface ResolveCliPluginRefInput {
  readonly ref: string;
  readonly source: Exclude<CliPluginSource, 'host'>;
  /**
   * The CLI's config directory. Config paths resolve against it, and package names are looked up in its
   * `node_modules` first.
   */
  readonly configDir?: Maybe<string>;
  /**
   * The directory flag paths resolve against. Never used to find a package.
   */
  readonly cwd: string;
  /**
   * The CLI's install location. Package names not found under the config dir are looked up from here, walking up
   * through each parent's `node_modules` as Node would for the CLI's own dependencies.
   */
  readonly installDir?: Maybe<string>;
}

/**
 * The result of {@link resolveCliPluginRef}.
 */
export type ResolveCliPluginRefResult = { readonly ok: true; readonly path: string } | { readonly ok: false; readonly message: string };

/**
 * Resolves a plugin reference to an absolute module path.
 *
 * - config paths resolve against the config dir; flag paths against cwd
 * - the env var accepts only absolute paths or package names
 * - package names resolve from `<configDir>/node_modules`, then from the CLI's install location — never from cwd, so
 *   running the CLI inside a cloned repo cannot pick up that repo's packages
 *
 * @param input - The reference, its source, and the directories it may resolve against.
 * @returns The absolute path, or why it did not resolve.
 */
export function resolveCliPluginRef(input: ResolveCliPluginRefInput): ResolveCliPluginRefResult {
  const { ref, source, configDir, cwd, installDir } = input;
  let result: ResolveCliPluginRefResult;

  if (isCliPluginPackageRef(ref)) {
    const roots = [...(configDir ? [configDir] : []), ...ancestorDirs(installDir)];
    const path = roots.map((root) => resolvePackageEntry(join(root, 'node_modules'), ref)).find((x) => x != null);
    result = path == null ? { ok: false, message: `package "${ref}" was not found in ${configDir ? `${join(configDir, 'node_modules')} or ` : ''}the CLI's install location` } : { ok: true, path };
  } else if (isAbsolute(ref)) {
    result = existsSync(ref) ? { ok: true, path: ref } : { ok: false, message: `${ref} does not exist` };
  } else if (source === 'env') {
    result = { ok: false, message: `"${ref}" is relative; the extensions env var only accepts absolute paths or package names` };
  } else if (source === 'config' && configDir == null) {
    result = { ok: false, message: `"${ref}" is relative and there is no config dir to resolve it against` };
  } else {
    const path = resolve(source === 'config' ? (configDir as string) : cwd, ref);
    result = existsSync(path) ? { ok: true, path } : { ok: false, message: `${path} does not exist` };
  }

  return result;
}

function ancestorDirs(dir: Maybe<string>): string[] {
  const dirs: string[] = [];
  let current = dir ? resolve(dir) : undefined;

  while (current != null) {
    dirs.push(current);
    const parent = dirname(current);
    current = parent === current ? undefined : parent;
  }

  return dirs;
}

/**
 * Finds a package's ESM entry inside one `node_modules` directory, without walking up.
 *
 * @param nodeModulesDir - The `node_modules` directory to look in.
 * @param ref - The package name, optionally with a subpath.
 * @returns The absolute entry path, or `undefined` when the package is not there.
 */
function resolvePackageEntry(nodeModulesDir: string, ref: string): Maybe<string> {
  const segments = ref.split('/');
  const nameLength = ref.startsWith('@') ? 2 : 1;
  const packageDir = join(nodeModulesDir, ...segments.slice(0, nameLength));
  const subpath = segments.slice(nameLength).join('/');
  const packageJsonPath = join(packageDir, 'package.json');
  let result: Maybe<string>;

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { exports?: unknown; module?: string; main?: string };
    const target = subpath ? `./${subpath}` : (packageExportsEntry(packageJson.exports) ?? packageJson.module ?? packageJson.main ?? 'index.js');
    const path = join(packageDir, target);
    result = existsSync(path) ? path : undefined;
  }

  return result;
}

function packageExportsEntry(exports: unknown): Maybe<string> {
  let entry: unknown = exports;

  if (entry != null && typeof entry === 'object' && '.' in entry) {
    entry = (entry as Record<string, unknown>)['.'];
  }

  while (entry != null && typeof entry === 'object') {
    const conditions = entry as Record<string, unknown>;
    entry = conditions['import'] ?? conditions['node'] ?? conditions['default'];
  }

  return typeof entry === 'string' ? entry : undefined;
}
