import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { pathToFileURL } from 'node:url';
import { prescanCliExtensionArgs, resolveCliPluginRef, type CliPluginSource } from './cli.plugin.resolve';

/**
 * The shape every CLI plugin shares, generic over the api the host hands to `setup` and what `setup` contributes
 * (commands, doctor checks, ...).
 */
export interface CliPlugin<A = unknown, R = unknown> {
  /**
   * The plugin api version the plugin was written against. A plugin whose version differs from the host's is skipped.
   */
  readonly apiVersion: number;
  /**
   * The plugin's name: lowercase letters, digits and dashes. Hosts typically mount its commands under it.
   */
  readonly name: string;
  readonly version?: Maybe<string>;
  /**
   * The oldest host version the plugin runs on (`major.minor.patch`).
   */
  readonly minHostVersion?: Maybe<string>;
  setup(api: A): PromiseOrValue<R>;
}

/**
 * A config `extensions[]` entry: a path or package name, optionally with options handed to that plugin.
 */
export type CliPluginConfigEntry = string | { readonly path: string; readonly options?: Maybe<Readonly<Record<string, unknown>>> };

/**
 * The step a plugin failed (or was skipped) at.
 */
export type CliPluginLoadStep = 'resolve' | 'import' | 'shape' | 'version' | 'name' | 'setup' | 'mount';

/**
 * One line of the load report: a plugin that loaded, or one that was skipped or failed and why.
 */
export interface CliPluginReportEntry {
  readonly source: CliPluginSource;
  /**
   * The reference as written (absent for host plugins).
   */
  readonly ref?: Maybe<string>;
  readonly path?: Maybe<string>;
  readonly name?: Maybe<string>;
  readonly version?: Maybe<string>;
  readonly status: 'loaded' | 'skipped' | 'failed';
  readonly step?: Maybe<CliPluginLoadStep>;
  readonly message?: Maybe<string>;
}

/**
 * A plugin that loaded, with what its `setup` contributed.
 */
export interface LoadedCliPlugin<A = unknown, R = unknown> {
  readonly plugin: CliPlugin<A, R>;
  readonly contribution: R;
  readonly report: CliPluginReportEntry;
}

/**
 * The context {@link LoadCliPluginsInput.createApi} builds a plugin's api from.
 */
export interface CliPluginApiContext {
  readonly source: CliPluginSource;
  readonly path?: Maybe<string>;
  readonly options: Readonly<Record<string, unknown>>;
}

/**
 * Input for {@link loadCliPlugins}.
 */
export interface LoadCliPluginsInput<A, R> {
  /**
   * The env var prefix: `<PREFIX>_EXTENSIONS` lists extra plugins (path-delimited) and `<PREFIX>_NO_EXTENSIONS=1`
   * disables every external source.
   */
  readonly envPrefix: string;
  /**
   * The plugin api version this host implements.
   */
  readonly apiVersion: number;
  /**
   * This host's version, checked against a plugin's `minHostVersion`.
   */
  readonly hostVersion?: Maybe<string>;
  /**
   * Plugins compiled into the host. Loaded first, and never disabled by `--no-extensions`.
   */
  readonly hostPlugins?: Maybe<readonly CliPlugin<A, R>[]>;
  /**
   * The config file's `extensions[]`.
   */
  readonly configExtensions?: Maybe<readonly CliPluginConfigEntry[]>;
  readonly configDir?: Maybe<string>;
  /**
   * The raw arguments (`process.argv.slice(2)`), pre-scanned for `--extension` / `--no-extensions`.
   */
  readonly argv?: Maybe<readonly string[]>;
  readonly env?: Maybe<Readonly<Record<string, string | undefined>>>;
  readonly cwd?: Maybe<string>;
  /**
   * The CLI's install location, a fallback for package-name lookups.
   */
  readonly installDir?: Maybe<string>;
  /**
   * Names a plugin may not take — the host's own top-level commands.
   */
  readonly reservedNames?: Maybe<readonly string[]>;
  /**
   * Builds the api a plugin's `setup` receives.
   */
  readonly createApi: (plugin: CliPlugin<A, R>, context: CliPluginApiContext) => A;
  /**
   * Optional check of what `setup` returned; return an error message to reject it.
   */
  readonly validateContribution?: Maybe<(contribution: R) => Maybe<string>>;
  /**
   * Mounts a loaded plugin (e.g. registers its commands). A throw fails only that plugin.
   */
  readonly mount?: Maybe<(loaded: LoadedCliPlugin<A, R>) => void>;
  /**
   * How long `setup` may take. Defaults to {@link DEFAULT_CLI_PLUGIN_SETUP_TIMEOUT_MS}.
   */
  readonly setupTimeoutMs?: Maybe<number>;
  /**
   * Test seam for the dynamic import. Defaults to `import(fileUrl)`.
   */
  readonly importModule?: Maybe<(url: string) => Promise<unknown>>;
  /**
   * Where the one-line failure notices go. Defaults to stderr.
   */
  readonly log?: Maybe<(line: string) => void>;
}

/**
 * The result of {@link loadCliPlugins}.
 */
export interface LoadCliPluginsResult<A, R> {
  readonly loaded: readonly LoadedCliPlugin<A, R>[];
  /**
   * One entry per reference, in load order.
   */
  readonly report: readonly CliPluginReportEntry[];
  /**
   * One line per plugin that failed or was skipped, for `meta.warnings`.
   */
  readonly warnings: readonly string[];
  /**
   * `true` when `--no-extensions` / `<PREFIX>_NO_EXTENSIONS` turned the external sources off.
   */
  readonly externalDisabled: boolean;
}

/**
 * Default `setup` timeout.
 */
export const DEFAULT_CLI_PLUGIN_SETUP_TIMEOUT_MS = 2000;

/**
 * The pattern a plugin name must match.
 */
export const CLI_PLUGIN_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

interface PendingCliPluginRef {
  readonly source: Exclude<CliPluginSource, 'host'>;
  readonly ref: string;
  readonly options: Readonly<Record<string, unknown>>;
}

/**
 * Loads a CLI's plugins from, in order: the host, the config's `extensions[]`, `<PREFIX>_EXTENSIONS`, and a repeatable
 * `--extension` flag. `--no-extensions` (or `<PREFIX>_NO_EXTENSIONS=1`) turns every source but the host off.
 *
 * Every step is isolated — resolve, import (with `console.*` sent to stderr so stdout stays a clean JSON envelope),
 * shape check, `apiVersion` / `minHostVersion`, name clash, `setup` (with a timeout) and mount. A failure becomes one
 * report entry, one stderr line and one warning, and the remaining plugins and the host's own commands keep working.
 * The same module referenced twice loads once.
 *
 * @param input - The sources, the host's version and reserved names, and the hooks that build the api and mount.
 * @returns The loaded plugins, the full report, and the warnings.
 */
export async function loadCliPlugins<A, R>(input: LoadCliPluginsInput<A, R>): Promise<LoadCliPluginsResult<A, R>> {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const log = input.log ?? ((line: string) => process.stderr.write(`${line}\n`));
  const args = prescanCliExtensionArgs(input.argv ?? []);
  const noExtensionsEnv = env[`${input.envPrefix}_NO_EXTENSIONS`];
  const externalDisabled = args.noExtensions || (noExtensionsEnv != null && noExtensionsEnv !== '' && noExtensionsEnv !== '0' && noExtensionsEnv !== 'false');
  const loaded: LoadedCliPlugin<A, R>[] = [];
  const report: CliPluginReportEntry[] = [];
  const warnings: string[] = [];
  const loadedPaths = new Map<string, CliPluginSource>();
  const reserved = new Set(input.reservedNames ?? []);

  function fail(entry: CliPluginReportEntry): void {
    report.push(entry);
    const label = entry.name ?? entry.ref ?? 'plugin';
    const line = `${entry.status === 'skipped' ? 'skipped' : 'failed to load'} plugin ${label} (${entry.source}${entry.step ? `, ${entry.step}` : ''}): ${entry.message ?? 'unknown error'}`;
    warnings.push(line);
    log(`[${input.envPrefix.toLowerCase().replaceAll('_', '-')}] ${line}`);
  }

  async function add(plugin: unknown, base: Omit<CliPluginReportEntry, 'status'>, options: Readonly<Record<string, unknown>>): Promise<void> {
    const shapeError = cliPluginShapeError(plugin);

    if (shapeError == null) {
      const candidate = plugin as CliPlugin<A, R>;
      const entry = { ...base, name: candidate.name, version: candidate.version ?? null };
      const versionError = cliPluginVersionError(candidate, input.apiVersion, input.hostVersion);
      const nameError = cliPluginNameError(candidate.name, reserved, loaded);

      if (versionError != null) {
        fail({ ...entry, status: 'skipped', step: 'version', message: versionError });
      } else if (nameError == null) {
        await setupAndMount(candidate, entry, options);
      } else {
        fail({ ...entry, status: 'failed', step: 'name', message: nameError });
      }
    } else {
      fail({ ...base, status: 'failed', step: 'shape', message: shapeError });
    }
  }

  async function setupAndMount(plugin: CliPlugin<A, R>, entry: Omit<CliPluginReportEntry, 'status'>, options: Readonly<Record<string, unknown>>): Promise<void> {
    let contribution: Maybe<R>;
    let setupError: Maybe<string>;

    try {
      const api = input.createApi(plugin, { source: entry.source, path: entry.path, options });
      contribution = await withConsoleOnStderr(() => withTimeout(Promise.resolve(plugin.setup(api)), input.setupTimeoutMs ?? DEFAULT_CLI_PLUGIN_SETUP_TIMEOUT_MS));
      setupError = input.validateContribution?.(contribution as R) ?? undefined;
    } catch (error) {
      setupError = errorMessage(error);
    }

    if (setupError == null) {
      const result: LoadedCliPlugin<A, R> = { plugin, contribution: contribution as R, report: { ...entry, status: 'loaded' } };

      try {
        input.mount?.(result);
        loaded.push(result);
        report.push(result.report);
      } catch (error) {
        fail({ ...entry, status: 'failed', step: 'mount', message: errorMessage(error) });
      }
    } else {
      fail({ ...entry, status: 'failed', step: 'setup', message: setupError });
    }
  }

  for (const plugin of input.hostPlugins ?? []) {
    await add(plugin, { source: 'host' }, {});
  }

  if (!externalDisabled) {
    const importModule = input.importModule ?? ((url: string) => import(/* @vite-ignore */ url));

    for (const pending of externalCliPluginRefs(input, env)) {
      const resolved = resolveCliPluginRef({ ref: pending.ref, source: pending.source, configDir: input.configDir, cwd, installDir: input.installDir });

      if (!resolved.ok) {
        fail({ source: pending.source, ref: pending.ref, status: 'failed', step: 'resolve', message: resolved.message });
      } else if (loadedPaths.has(resolved.path)) {
        report.push({ source: pending.source, ref: pending.ref, path: resolved.path, status: 'skipped', step: 'resolve', message: `already loaded from ${loadedPaths.get(resolved.path)}` });
      } else {
        loadedPaths.set(resolved.path, pending.source);
        const base = { source: pending.source, ref: pending.ref, path: resolved.path };
        let module: unknown;
        let importError: Maybe<string>;

        try {
          module = await withConsoleOnStderr(() => importModule(pathToFileURL(resolved.path).href));
        } catch (error) {
          importError = errorMessage(error);
        }

        if (importError == null) {
          const exports = module as Maybe<{ readonly default?: unknown; readonly plugin?: unknown }>;
          await add(exports?.default ?? exports?.plugin, base, pending.options);
        } else {
          fail({ ...base, status: 'failed', step: 'import', message: importError });
        }
      }
    }
  }

  return { loaded, report, warnings, externalDisabled };
}

function externalCliPluginRefs<A, R>(input: LoadCliPluginsInput<A, R>, env: Readonly<Record<string, string | undefined>>): PendingCliPluginRef[] {
  const refs: PendingCliPluginRef[] = [];

  for (const entry of input.configExtensions ?? []) {
    refs.push(typeof entry === 'string' ? { source: 'config', ref: entry, options: {} } : { source: 'config', ref: entry.path, options: entry.options ?? {} });
  }

  const envValue = env[`${input.envPrefix}_EXTENSIONS`] ?? '';
  const delimiter = process.platform === 'win32' ? ';' : ':';

  for (const ref of envValue.split(delimiter)) {
    if (ref.trim().length > 0) {
      refs.push({ source: 'env', ref: ref.trim(), options: {} });
    }
  }

  for (const ref of prescanCliExtensionArgs(input.argv ?? []).extensions) {
    refs.push({ source: 'flag', ref, options: {} });
  }

  return refs;
}

/**
 * Checks that a value looks like a {@link CliPlugin}.
 *
 * @param plugin - The module's default (or `plugin`) export.
 * @returns Why it is not a plugin, or `undefined` when it is.
 */
export function cliPluginShapeError(plugin: unknown): Maybe<string> {
  let result: Maybe<string>;

  if (plugin == null || typeof plugin !== 'object') {
    result = 'the module has no default (or `plugin`) export object';
  } else {
    const candidate = plugin as Partial<CliPlugin>;

    if (typeof candidate.apiVersion !== 'number') {
      result = 'the plugin has no numeric `apiVersion`';
    } else if (typeof candidate.name !== 'string') {
      result = 'the plugin has no `name`';
    } else if (typeof candidate.setup !== 'function') {
      result = 'the plugin has no `setup` function';
    }
  }

  return result;
}

function cliPluginVersionError(plugin: CliPlugin<unknown, unknown>, apiVersion: number, hostVersion: Maybe<string>): Maybe<string> {
  let result: Maybe<string>;

  if (plugin.apiVersion !== apiVersion) {
    result = `plugin apiVersion ${plugin.apiVersion} is not supported (the host implements ${apiVersion})`;
  } else if (plugin.minHostVersion != null && hostVersion != null && compareCliVersions(hostVersion, plugin.minHostVersion) < 0) {
    result = `needs host version ${plugin.minHostVersion} or newer (this is ${hostVersion})`;
  }

  return result;
}

function cliPluginNameError(name: string, reserved: ReadonlySet<string>, loaded: readonly LoadedCliPlugin<unknown, unknown>[]): Maybe<string> {
  let result: Maybe<string>;

  if (!CLI_PLUGIN_NAME_PATTERN.test(name)) {
    result = `"${name}" is not a valid plugin name (lowercase letters, digits and dashes)`;
  } else if (reserved.has(name)) {
    result = `"${name}" clashes with a built-in command`;
  } else if (loaded.some((x) => x.plugin.name === name)) {
    result = `a plugin named "${name}" is already loaded`;
  }

  return result;
}

/**
 * Compares two `major.minor.patch` versions numerically; a pre-release suffix is ignored.
 *
 * @param a - The first version.
 * @param b - The second version.
 * @returns Negative when `a < b`, zero when equal, positive when `a > b`.
 */
export function compareCliVersions(a: string, b: string): number {
  const parse = (version: string) => version.split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
  const [left, right] = [parse(a), parse(b)];
  let result = 0;

  for (let i = 0; i < Math.max(left.length, right.length) && result === 0; i += 1) {
    result = (left[i] ?? 0) - (right[i] ?? 0);
  }

  return result;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: Maybe<ReturnType<typeof setTimeout>>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`setup did not finish within ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer ?? undefined);
  }
}

/**
 * Runs `fn` with `console.log` / `console.info` / `console.debug` redirected to `console.error`, so a plugin that
 * prints while it loads cannot corrupt the JSON envelope on stdout.
 *
 * @param fn - The work to run.
 * @returns Whatever `fn` resolved to.
 */
export async function withConsoleOnStderr<T>(fn: () => Promise<T>): Promise<T> {
  const original = { log: console.log, info: console.info, debug: console.debug };
  const toStderr = (...args: unknown[]) => console.error(...args);
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;

  try {
    return await fn();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.debug = original.debug;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
