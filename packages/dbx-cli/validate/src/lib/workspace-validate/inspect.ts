/**
 * Filesystem inspection for `dbx_workspace_validate`.
 *
 * The only layer that touches disk. Walks the workspace for `project.json`
 * files, normalises every target into an {@link InspectedTarget}, resolves
 * the existence of each file the build configurations point at, collects
 * target references from every place they hide (project commands, CI config,
 * root shell scripts, npm scripts), and reads the `firebase.json` facts the
 * deploy rules need.
 *
 * Pure rules consume the resulting {@link WorkspaceInspection}; specs build
 * inspections directly without touching the disk.
 */

import { type Dirent, type Stats } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { scanDocumentTargetReferences, scanTargetReferences } from './references.js';
import type { InspectedFileReplacement, InspectedFirebaseConfig, InspectedNxConfig, InspectedProject, InspectedTarget, InspectedTargetConfiguration, InspectedTargetReference, WorkspaceInspection } from './types.js';

/**
 * Directory names never walked when discovering projects. Keeps the walk off
 * dependency trees, build output, and emulator exports — all of which can
 * contain a stray `project.json`.
 */
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'tmp', 'coverage', '.nx', '.git', '.firebase', '.angular', '.cache', 'templates']);

/**
 * Maximum directory depth searched for a `project.json`. Four covers the
 * deepest real layout (`packages/<pkg>/<subpath>/project.json`).
 */
const MAX_WALK_DEPTH = 4;

const PROJECT_CONFIG_FILENAME = 'project.json';
const ENVIRONMENTS_SUBPATH = join('src', 'environments');
const ENVIRONMENT_FILE_PATTERN = /^environment\..+\.ts$/;

/**
 * Root-level files scanned for target references in addition to the projects
 * themselves. A reference in CI or a deploy script is exactly as load-bearing
 * as one in a `project.json`, and rots the same way.
 */
const EXTRA_REFERENCE_SOURCES: readonly string[] = ['.circleci/config.yml', '.circleci/config.yaml', '.github/workflows'];

/**
 * Whether a path exists on disk.
 *
 * @param path - Absolute path to probe.
 * @returns `true` when `stat` resolves.
 */
async function pathExists(path: string): Promise<boolean> {
  let result: boolean;
  try {
    await stat(path);
    result = true;
  } catch {
    result = false;
  }
  return result;
}

/**
 * Reads and parses a JSON file, returning `undefined` when absent or malformed.
 *
 * @param path - Absolute path to the JSON file.
 * @returns The parsed value, or `undefined`.
 */
async function readJsonFile(path: string): Promise<Record<string, unknown> | undefined> {
  let result: Record<string, unknown> | undefined;
  try {
    const text = await readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(text);
    result = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    result = undefined;
  }
  return result;
}

/**
 * Recursively collects workspace-relative `project.json` paths.
 *
 * @param config - Shared call config.
 * @param config.workspaceRoot - Absolute workspace root.
 * @param config.relativeDir - Workspace-relative directory to walk.
 * @param config.depth - Current depth, bounded by {@link MAX_WALK_DEPTH}.
 * @returns The discovered workspace-relative config paths.
 */
async function collectProjectConfigPaths(config: { readonly workspaceRoot: string; readonly relativeDir: string; readonly depth: number }): Promise<readonly string[]> {
  const { workspaceRoot, relativeDir, depth } = config;
  const collected: string[] = [];
  const absoluteDir = join(workspaceRoot, relativeDir);
  const entries: Dirent[] = await readdir(absoluteDir, { withFileTypes: true }).catch((): Dirent[] => []);
  for (const entry of entries) {
    if (entry.isFile() && entry.name === PROJECT_CONFIG_FILENAME) {
      collected.push(relativeDir === '' ? PROJECT_CONFIG_FILENAME : join(relativeDir, PROJECT_CONFIG_FILENAME));
    } else if (entry.isDirectory() && depth < MAX_WALK_DEPTH && !SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith('firebase-export-')) {
      const nested = await collectProjectConfigPaths({ workspaceRoot, relativeDir: relativeDir === '' ? entry.name : join(relativeDir, entry.name), depth: depth + 1 });
      for (const path of nested) {
        collected.push(path);
      }
    }
  }
  return collected;
}

/**
 * Flattens a target's `options.command` / `options.commands` into plain
 * strings. Nx accepts a bare string, an array of strings, and an array of
 * `{ command, description }` records; all three appear in these workspaces.
 *
 * @param options - The target's resolved options object.
 * @returns Every command string the target runs.
 */
function extractCommands(options: Record<string, unknown>): readonly string[] {
  const collected: string[] = [];
  const single = options['command'];
  if (typeof single === 'string') {
    collected.push(single);
  }
  const many = options['commands'];
  if (Array.isArray(many)) {
    for (const entry of many) {
      if (typeof entry === 'string') {
        collected.push(entry);
      } else if (entry !== null && typeof entry === 'object') {
        const command = (entry as Record<string, unknown>)['command'];
        if (typeof command === 'string') {
          collected.push(command);
        }
      }
    }
  }
  return collected;
}

/**
 * Resolves the `fileReplacements` entries declared on one configuration,
 * stamping each side's on-disk existence.
 *
 * @param config - Shared call config.
 * @param config.workspaceRoot - Absolute workspace root.
 * @param config.raw - The configuration's raw `fileReplacements` value.
 * @returns The normalised replacement records.
 */
async function resolveFileReplacements(config: { readonly workspaceRoot: string; readonly raw: unknown }): Promise<readonly InspectedFileReplacement[]> {
  const { workspaceRoot, raw } = config;
  const collected: InspectedFileReplacement[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry === null || typeof entry !== 'object') {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const replace = record['replace'];
      const withPath = record['with'];
      if (typeof replace === 'string' && typeof withPath === 'string') {
        collected.push({
          replace,
          with: withPath,
          replaceExists: await pathExists(join(workspaceRoot, replace)),
          withExists: await pathExists(join(workspaceRoot, withPath))
        });
      }
    }
  }
  return collected;
}

/**
 * Normalises one target's `configurations` map.
 *
 * @param config - Shared call config.
 * @param config.workspaceRoot - Absolute workspace root.
 * @param config.raw - The target's raw `configurations` value.
 * @returns One record per declared configuration, in declaration order.
 */
async function resolveConfigurations(config: { readonly workspaceRoot: string; readonly raw: unknown }): Promise<readonly InspectedTargetConfiguration[]> {
  const { workspaceRoot, raw } = config;
  const collected: InspectedTargetConfiguration[] = [];
  if (raw !== null && typeof raw === 'object') {
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      const options = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const esbuildConfigValue = options['esbuildConfig'];
      const esbuildConfig = typeof esbuildConfigValue === 'string' ? esbuildConfigValue : undefined;
      collected.push({
        name,
        fileReplacements: await resolveFileReplacements({ workspaceRoot, raw: options['fileReplacements'] }),
        esbuildConfig,
        esbuildConfigExists: esbuildConfig === undefined ? false : await pathExists(join(workspaceRoot, esbuildConfig))
      });
    }
  }
  return collected;
}

/**
 * Normalises every target declared by one `project.json`.
 *
 * @param config - Shared call config.
 * @param config.workspaceRoot - Absolute workspace root.
 * @param config.raw - The raw `targets` map.
 * @returns One record per target, in declaration order.
 */
async function resolveTargets(config: { readonly workspaceRoot: string; readonly raw: unknown }): Promise<readonly InspectedTarget[]> {
  const { workspaceRoot, raw } = config;
  const collected: InspectedTarget[] = [];
  if (raw !== null && typeof raw === 'object') {
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      const target = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const executorValue = target['executor'];
      const defaultConfigurationValue = target['defaultConfiguration'];
      const optionsValue = target['options'];
      const options = optionsValue !== null && typeof optionsValue === 'object' ? (optionsValue as Record<string, unknown>) : {};
      const outputsValue = target['outputs'];
      collected.push({
        name,
        executor: typeof executorValue === 'string' ? executorValue : undefined,
        configurations: await resolveConfigurations({ workspaceRoot, raw: target['configurations'] }),
        defaultConfiguration: typeof defaultConfigurationValue === 'string' ? defaultConfigurationValue : undefined,
        outputs: Array.isArray(outputsValue) ? outputsValue.filter((o): o is string => typeof o === 'string') : [],
        options,
        commands: extractCommands(options)
      });
    }
  }
  return collected;
}

/**
 * Lists the `environment.<name>.ts` files under a project's
 * `src/environments/` directory.
 *
 * @param config - Shared call config.
 * @param config.workspaceRoot - Absolute workspace root.
 * @param config.projectRoot - Workspace-relative project directory.
 * @returns The workspace-relative environment file paths, sorted.
 */
async function collectEnvironmentFiles(config: { readonly workspaceRoot: string; readonly projectRoot: string }): Promise<readonly string[]> {
  const { workspaceRoot, projectRoot } = config;
  const relativeDir = projectRoot === '' ? ENVIRONMENTS_SUBPATH : join(projectRoot, ENVIRONMENTS_SUBPATH);
  const collected: string[] = [];
  const entries: Dirent[] = await readdir(join(workspaceRoot, relativeDir), { withFileTypes: true }).catch((): Dirent[] => []);
  for (const entry of entries) {
    if (entry.isFile() && ENVIRONMENT_FILE_PATTERN.test(entry.name)) {
      collected.push(join(relativeDir, entry.name));
    }
  }
  return collected.sort((a, b) => a.localeCompare(b));
}

/**
 * Matches an environment module filename anywhere in a source text.
 */
const ENVIRONMENT_MENTION_PATTERN = /environment(?:\.[A-Za-z0-9_-]+)*\.ts/g;

/**
 * Collects the environment files a project's build actually consumes.
 *
 * Two mechanisms, one per bundler. An Angular `application` build names the
 * file directly in `fileReplacements`. An `@nx/esbuild:esbuild` build has no
 * `fileReplacements` equivalent, so the lane points at an `esbuildConfig`
 * file that performs the swap — which means the only way to know which
 * environment a lane selects is to read that config file.
 *
 * @param config - Shared call config.
 * @param config.workspaceRoot - Absolute workspace root.
 * @param config.targets - The project's normalised targets.
 * @param config.environmentFiles - The project's discovered environment files.
 * @returns The workspace-relative environment paths reachable from the build, sorted.
 */
async function collectReferencedEnvironmentFiles(config: { readonly workspaceRoot: string; readonly targets: readonly InspectedTarget[]; readonly environmentFiles: readonly string[] }): Promise<readonly string[]> {
  const { workspaceRoot, targets, environmentFiles } = config;
  const referenced = new Set<string>();
  const esbuildConfigPaths = new Set<string>();

  for (const target of targets) {
    const baseEsbuildConfig = target.options['esbuildConfig'];
    if (typeof baseEsbuildConfig === 'string') {
      esbuildConfigPaths.add(baseEsbuildConfig);
    }
    for (const configuration of target.configurations) {
      for (const replacement of configuration.fileReplacements) {
        referenced.add(replacement.with);
      }
      if (configuration.esbuildConfig !== undefined) {
        esbuildConfigPaths.add(configuration.esbuildConfig);
      }
    }
  }

  const mentionedBasenames = new Set<string>();
  for (const configPath of esbuildConfigPaths) {
    const text = await readFile(join(workspaceRoot, configPath), 'utf8').catch(() => undefined);
    if (text === undefined) {
      continue;
    }
    for (const match of text.matchAll(ENVIRONMENT_MENTION_PATTERN)) {
      mentionedBasenames.add(match[0]);
    }
  }
  for (const environmentFile of environmentFiles) {
    if (mentionedBasenames.has(basename(environmentFile))) {
      referenced.add(environmentFile);
    }
  }

  return Array.from(referenced).sort((a, b) => a.localeCompare(b));
}

/**
 * Reads one `project.json` into an {@link InspectedProject}.
 *
 * @param config - Shared call config.
 * @param config.workspaceRoot - Absolute workspace root.
 * @param config.configFile - Workspace-relative path to the `project.json`.
 * @returns The project record, or `undefined` when the file is unreadable.
 */
async function inspectProject(config: { readonly workspaceRoot: string; readonly configFile: string }): Promise<InspectedProject | undefined> {
  const { workspaceRoot, configFile } = config;
  const parsed = await readJsonFile(join(workspaceRoot, configFile));
  if (parsed === undefined) {
    return undefined;
  }
  const projectRoot = dirname(configFile) === '.' ? '' : dirname(configFile);
  const nameValue = parsed['name'];
  const fallbackNameDir = projectRoot === '' ? workspaceRoot : projectRoot;
  const name = typeof nameValue === 'string' && nameValue.length > 0 ? nameValue : basename(fallbackNameDir);
  const targets = await resolveTargets({ workspaceRoot, raw: parsed['targets'] });
  const environmentFiles = await collectEnvironmentFiles({ workspaceRoot, projectRoot });
  return {
    name,
    root: projectRoot,
    configFile,
    targets,
    environmentFiles,
    referencedEnvironmentFiles: await collectReferencedEnvironmentFiles({ workspaceRoot, targets, environmentFiles })
  };
}

/**
 * Reads the `nx.json` facts the target rules need.
 *
 * @param workspaceRoot - Absolute workspace root.
 * @returns The target-name-keyed `targetDefaults` keys and configured plugin ids.
 */
async function inspectNxConfig(workspaceRoot: string): Promise<InspectedNxConfig> {
  const parsed = await readJsonFile(join(workspaceRoot, 'nx.json'));
  const targetDefaultNames: string[] = [];
  const plugins: string[] = [];
  const targetDefaults = parsed?.['targetDefaults'];
  if (targetDefaults !== null && typeof targetDefaults === 'object') {
    for (const key of Object.keys(targetDefaults as Record<string, unknown>)) {
      if (!key.includes(':')) {
        targetDefaultNames.push(key);
      }
    }
  }
  const pluginsValue = parsed?.['plugins'];
  if (Array.isArray(pluginsValue)) {
    for (const entry of pluginsValue) {
      if (typeof entry === 'string') {
        plugins.push(entry);
      } else if (entry !== null && typeof entry === 'object') {
        const plugin = (entry as Record<string, unknown>)['plugin'];
        if (typeof plugin === 'string') {
          plugins.push(plugin);
        }
      }
    }
  }
  return { targetDefaultNames, plugins };
}

/**
 * Reads the `firebase.json` facts the deploy rules need.
 *
 * @param workspaceRoot - Absolute workspace root.
 * @returns The hosting-target list and a presence flag.
 */
async function inspectFirebaseConfig(workspaceRoot: string): Promise<InspectedFirebaseConfig> {
  const parsed = await readJsonFile(join(workspaceRoot, 'firebase.json'));
  if (parsed === undefined) {
    return { present: false, hostingTargets: [] };
  }
  const hostingValue = parsed['hosting'];
  const singleHostingEntry: readonly unknown[] = hostingValue !== null && typeof hostingValue === 'object' ? [hostingValue] : [];
  const entries: readonly unknown[] = Array.isArray(hostingValue) ? hostingValue : singleHostingEntry;
  const hostingTargets: string[] = [];
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const target = record['target'];
    const site = record['site'];
    if (typeof target === 'string') {
      hostingTargets.push(target);
    } else if (typeof site === 'string') {
      hostingTargets.push(site);
    }
  }
  return { present: true, hostingTargets };
}

/**
 * Collects the workspace-relative paths of every extra file scanned for
 * target references — CI configs plus the root-level shell scripts.
 *
 * @param workspaceRoot - Absolute workspace root.
 * @returns The workspace-relative paths that exist.
 */
async function collectExtraReferenceSources(workspaceRoot: string): Promise<readonly string[]> {
  const collected: string[] = [];
  for (const candidate of EXTRA_REFERENCE_SOURCES) {
    const absolute = join(workspaceRoot, candidate);
    let stats: Stats | undefined;
    try {
      stats = await stat(absolute);
    } catch {
      continue;
    }
    if (stats.isFile()) {
      collected.push(candidate);
    } else if (stats.isDirectory()) {
      const entries = await readdir(absolute, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.ya?ml$/.test(entry.name)) {
          collected.push(join(candidate, entry.name));
        }
      }
    }
  }
  const rootEntries = await readdir(workspaceRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.sh')) {
      collected.push(entry.name);
    }
  }
  return collected.sort((a, b) => a.localeCompare(b));
}

/**
 * Collects the target references declared in the root `package.json` scripts.
 *
 * @param workspaceRoot - Absolute workspace root.
 * @returns Every reference found in the scripts map.
 */
async function collectPackageScriptReferences(workspaceRoot: string): Promise<readonly InspectedTargetReference[]> {
  const parsed = await readJsonFile(join(workspaceRoot, 'package.json'));
  const scripts = parsed?.['scripts'];
  const collected: InspectedTargetReference[] = [];
  if (scripts !== null && typeof scripts === 'object') {
    for (const [scriptName, value] of Object.entries(scripts as Record<string, unknown>)) {
      if (typeof value === 'string') {
        for (const reference of scanTargetReferences({ text: value, sourceFile: 'package.json', sourceTarget: scriptName })) {
          collected.push(reference);
        }
      }
    }
  }
  return collected;
}

/**
 * Input for {@link inspectWorkspace}.
 */
export interface InspectWorkspaceInput {
  /**
   * Absolute path to the workspace root.
   */
  readonly workspaceRoot: string;
}

/**
 * Walks a workspace and builds the snapshot the rules run against.
 *
 * @param input - The workspace root to inspect.
 * @returns The full workspace inspection.
 */
export async function inspectWorkspace(input: InspectWorkspaceInput): Promise<WorkspaceInspection> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const configPaths = await collectProjectConfigPaths({ workspaceRoot, relativeDir: '', depth: 0 });

  const projects: InspectedProject[] = [];
  const references: InspectedTargetReference[] = [];

  for (const configFile of [...configPaths].sort((a, b) => a.localeCompare(b))) {
    const project = await inspectProject({ workspaceRoot, configFile });
    if (project === undefined) {
      continue;
    }
    projects.push(project);
    for (const target of project.targets) {
      for (const command of target.commands) {
        for (const reference of scanTargetReferences({ text: command, sourceFile: configFile, sourceTarget: target.name })) {
          references.push(reference);
        }
      }
    }
  }

  for (const sourceFile of await collectExtraReferenceSources(workspaceRoot)) {
    const text = await readFile(join(workspaceRoot, sourceFile), 'utf8').catch(() => undefined);
    if (text !== undefined) {
      for (const reference of scanDocumentTargetReferences({ text, sourceFile })) {
        references.push(reference);
      }
    }
  }

  for (const reference of await collectPackageScriptReferences(workspaceRoot)) {
    references.push(reference);
  }

  return {
    workspaceRoot,
    projects,
    references,
    firebase: await inspectFirebaseConfig(workspaceRoot),
    nx: await inspectNxConfig(workspaceRoot)
  };
}

/**
 * Resolves a workspace-relative path against the workspace root and reports
 * whether it escapes the root. Exposed for the `outputs` rule, which needs
 * the same resolution Nx itself applies to an un-anchored `outputs` entry.
 *
 * @param config - Shared call config.
 * @param config.workspaceRoot - Absolute workspace root.
 * @param config.candidate - The path to test, relative to the workspace root.
 * @returns `true` when the resolved path lands outside the workspace root.
 */
export function pathEscapesWorkspaceRoot(config: { readonly workspaceRoot: string; readonly candidate: string }): boolean {
  const { workspaceRoot, candidate } = config;
  const resolved = resolve(workspaceRoot, candidate);
  const rel = relative(workspaceRoot, resolved);
  return rel.startsWith('..');
}
