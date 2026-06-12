/**
 * Build-time route manifest: the authoritative schema + builder that the
 * `dbx-cli-generate-route-manifest` binary serializes to `route.manifest.json`.
 *
 * The firebase-server/mcp runtime mirrors this schema in
 * `service/mcp.route-manifest.ts` (it does NOT import this package); both bump
 * {@link ROUTE_MANIFEST_VERSION} together when the shape changes.
 *
 * The builder runs the route extractor over the app sources, drops future-state
 * (`.**`) nodes, resolves each rendered component's `@dbxRouteModel*` tags,
 * merges them with the state const's own tags, pre-flattens ancestor
 * inheritance (recording each inherited entry's `from`), and emits a flat,
 * name-sorted state array. Warnings are collected but never throw — the
 * generator writes the manifest and logs them.
 */

import { Project } from 'ts-morph';
import { resolveComponentSourceFromSources } from './component-resolve.js';
import { loadRouteTree } from './route-load-tree.js';
import { extractComponentRouteModelTags, parseRouteModelTag, type ParsedRouteModel, type RouteModelKind } from './route-models-extract.js';
import type { RouteSource, RouteTree, RouteTreeNode } from './route-types.js';
import { extractUrlParamKeys } from './url-match.js';

/**
 * Version stamp embedded in `route.manifest.json`. Runtime loaders refuse
 * manifests whose `version` does not match. Mirror in firebase-server/mcp's
 * `ROUTE_MANIFEST_VERSION` — bump both together.
 */
export const ROUTE_MANIFEST_VERSION = 1 as const;

/**
 * One model an app page renders, after tag parsing + inheritance flattening.
 */
export interface RouteManifestModelEntry {
  readonly modelType: string;
  readonly kind: RouteModelKind;
  /**
   * Verbatim key template (`:uid`, `{authUid}`, `gb/:id/gbe/{authUid}`). Absent
   * for `list` entries.
   */
  readonly keyTemplate?: string;
  readonly description?: string;
  /**
   * When the entry was inherited from an ancestor state, that ancestor's name.
   * Absent for a state's own (component + state-tag) models.
   */
  readonly from?: string;
}

/**
 * One UIRouter state, with inheritance pre-flattened into `models`.
 */
export interface RouteManifestStateEntry {
  readonly name: string;
  readonly url?: string;
  readonly fullUrl?: string;
  readonly parentName?: string;
  readonly paramKeys: readonly string[];
  readonly urlParamKeys: readonly string[];
  readonly component?: string;
  readonly componentFile?: string;
  readonly abstract?: boolean;
  readonly redirectTo?: string;
  readonly models: readonly RouteManifestModelEntry[];
}

/**
 * The full `route.manifest.json` shape consumed at runtime by the `url-models`
 * tool. `states` is a flat array (inheritance pre-flattened at build).
 */
export interface RouteManifest {
  readonly version: typeof ROUTE_MANIFEST_VERSION;
  readonly generatedAt: string;
  readonly app: {
    readonly name: string;
    readonly baseUrl?: string;
  };
  readonly states: readonly RouteManifestStateEntry[];
}

/**
 * Kinds of non-fatal finding surfaced while building the manifest.
 */
export type RouteManifestWarningKind = 'malformed-tag' | 'unknown-route-param' | 'unknown-model-type' | 'duplicate-route-model' | 'dropped-future-state' | 'missing-route-model';

/**
 * Severity of a {@link RouteManifestWarning}. `error`-severity findings fail
 * manifest generation (and CI via the build dependency); `warning`-severity
 * findings are logged but do not block.
 */
export type RouteManifestSeverity = 'error' | 'warning';

export interface RouteManifestWarning {
  readonly kind: RouteManifestWarningKind;
  readonly severity: RouteManifestSeverity;
  readonly message: string;
  readonly stateName?: string;
  readonly modelType?: string;
  /**
   * The id-like route param a `missing-route-model` finding refers to (`:id` →
   * `id`). Absent for other warning kinds.
   */
  readonly param?: string;
}

/**
 * App identity stamped onto the manifest.
 */
export interface BuildRouteManifestApp {
  readonly name: string;
  readonly baseUrl?: string;
}

/**
 * Input to {@link buildRouteManifest}.
 */
export interface BuildRouteManifestInput {
  readonly app: BuildRouteManifestApp;
  readonly sources: readonly RouteSource[];
  /**
   * Known Firestore model types for `unknown-model-type` validation. When
   * omitted (no `--models-input`), the check is skipped.
   */
  readonly modelTypes?: readonly string[];
}

/**
 * Output of {@link buildRouteManifest}: the rendered manifest plus the
 * accumulated warnings.
 */
export interface BuildRouteManifestResult {
  readonly manifest: RouteManifest;
  readonly warnings: readonly RouteManifestWarning[];
}

/**
 * Builds the route manifest from a set of app sources.
 *
 * @param input - The app identity, source set, and optional model-type catalog.
 * @param now - Override for the `generatedAt` timestamp (tests pass a fixed value).
 * @returns The rendered manifest and the collected warnings.
 *
 * @example
 * ```ts
 * const { manifest, warnings } = buildRouteManifest({ app: { name: 'demo' }, sources });
 * ```
 */
export function buildRouteManifest(input: BuildRouteManifestInput, now: Date = new Date()): BuildRouteManifestResult {
  const warnings: RouteManifestWarning[] = [];
  const tree = loadRouteTree({ sources: input.sources });
  const project = buildSourceProject(input.sources);
  const modelTypeSet = input.modelTypes == null ? undefined : new Set(input.modelTypes);

  const realNames = collectRealStateNames(tree);
  warnDroppedFutureStates(tree, realNames, warnings);

  const ownModelsByName = new Map<string, readonly RouteManifestModelEntry[]>();
  for (const node of tree.byName.values()) {
    if (node.data.futureState) {
      continue;
    }
    ownModelsByName.set(node.data.name, computeOwnModels({ node, project, sources: input.sources, modelTypeSet, warnings }));
  }

  const states: RouteManifestStateEntry[] = [];
  for (const node of tree.byName.values()) {
    if (node.data.futureState) {
      continue;
    }
    states.push(buildStateEntry({ node, ownModelsByName, sources: input.sources }));
  }
  states.sort((a, b) => a.name.localeCompare(b.name));

  detectMissingRouteModels(states, warnings);

  const manifest: RouteManifest = {
    version: ROUTE_MANIFEST_VERSION,
    generatedAt: now.toISOString(),
    app: input.app.baseUrl == null ? { name: input.app.name } : { name: input.app.name, baseUrl: input.app.baseUrl },
    states
  };

  return { manifest, warnings };
}

// MARK: Source project
function buildSourceProject(sources: readonly RouteSource[]): Project {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const source of sources) {
    project.createSourceFile(source.name, source.text, { overwrite: true });
  }
  return project;
}

// MARK: Future-state handling
function collectRealStateNames(tree: RouteTree): ReadonlySet<string> {
  const names = new Set<string>();
  for (const node of tree.byName.values()) {
    if (!node.data.futureState) {
      names.add(node.data.name);
    }
  }
  return names;
}

/**
 * Warns when a dropped future state (`X.**`) has no real subtree — i.e. neither
 * `X` nor any `X.*` state survives — so the page it represents will be invisible
 * to URL matching.
 *
 * @param tree - The extracted route tree.
 * @param realNames - The names of the non-future states.
 * @param warnings - The accumulating warning list to append to.
 */
function warnDroppedFutureStates(tree: RouteTree, realNames: ReadonlySet<string>, warnings: RouteManifestWarning[]): void {
  for (const node of tree.byName.values()) {
    if (!node.data.futureState) {
      continue;
    }
    const prefix = node.data.name.slice(0, -3);
    const hasRealSubtree = realNames.has(prefix) || [...realNames].some((name) => name.startsWith(`${prefix}.`));
    if (!hasRealSubtree) {
      warnings.push({ kind: 'dropped-future-state', severity: 'warning', message: `Future state \`${node.data.name}\` was dropped and has no real subtree under \`${prefix}\`; its page will not match any URL.`, stateName: node.data.name });
    }
  }
}

// MARK: Own model resolution + merge
interface ComputeOwnModelsInput {
  readonly node: RouteTreeNode;
  readonly project: Project;
  readonly sources: readonly RouteSource[];
  readonly modelTypeSet: ReadonlySet<string> | undefined;
  readonly warnings: RouteManifestWarning[];
}

function computeOwnModels(input: ComputeOwnModelsInput): readonly RouteManifestModelEntry[] {
  const { node, project, sources, modelTypeSet, warnings } = input;
  const componentModels = parseComponentModels({ node, project, sources, warnings });
  const stateModels = parseStateModels({ node, warnings });

  // State tags override component tags by modelType (and augment new types).
  const overriddenTypes = new Set(stateModels.map((m) => m.modelType));
  const merged: ParsedRouteModel[] = [...componentModels.filter((m) => !overriddenTypes.has(m.modelType)), ...stateModels];

  const urlParamKeys = new Set(extractUrlParamKeys(node.fullUrl));
  const deduped = dedupeModels({ models: merged, stateName: node.data.name, warnings });
  return deduped.map((m) => finalizeModel({ model: m, stateName: node.data.name, urlParamKeys, modelTypeSet, warnings }));
}

interface ParseComponentModelsInput {
  readonly node: RouteTreeNode;
  readonly project: Project;
  readonly sources: readonly RouteSource[];
  readonly warnings: RouteManifestWarning[];
}

function parseComponentModels(input: ParseComponentModelsInput): readonly ParsedRouteModel[] {
  const { node, project, sources, warnings } = input;
  const component = node.data.component;
  if (component == null) {
    return [];
  }
  const resolved = resolveComponentSourceFromSources({ routerFile: node.data.file, component, sources });
  const componentFile = resolved?.path;
  if (componentFile == null) {
    return [];
  }
  const sourceFile = project.getSourceFile(componentFile);
  if (sourceFile == null) {
    return [];
  }
  return parseTags({ tags: extractComponentRouteModelTags(sourceFile, component), stateName: node.data.name, warnings });
}

function parseStateModels(input: { node: RouteTreeNode; warnings: RouteManifestWarning[] }): readonly ParsedRouteModel[] {
  const tags = input.node.data.jsDocTags ?? [];
  return parseTags({ tags, stateName: input.node.data.name, warnings: input.warnings });
}

interface ParseTagsInput {
  readonly tags: readonly { readonly name: string; readonly text: string }[];
  readonly stateName: string;
  readonly warnings: RouteManifestWarning[];
}

function parseTags(input: ParseTagsInput): readonly ParsedRouteModel[] {
  const out: ParsedRouteModel[] = [];
  for (const tag of input.tags) {
    const parsed = parseRouteModelTag(tag);
    if (parsed.ok) {
      out.push(parsed.model);
    } else {
      input.warnings.push({ kind: 'malformed-tag', severity: 'error', message: parsed.message, stateName: input.stateName });
    }
  }
  return out;
}

interface DedupeModelsInput {
  readonly models: readonly ParsedRouteModel[];
  readonly stateName: string;
  readonly warnings: RouteManifestWarning[];
}

function dedupeModels(input: DedupeModelsInput): readonly ParsedRouteModel[] {
  const seen = new Set<string>();
  const out: ParsedRouteModel[] = [];
  for (const model of input.models) {
    const key = modelDedupeKey(model.modelType, model.keyTemplate);
    if (seen.has(key)) {
      const keyPart = model.keyTemplate == null ? '' : ` ${model.keyTemplate}`;
      input.warnings.push({ kind: 'duplicate-route-model', severity: 'warning', message: `State \`${input.stateName}\` declares \`${model.modelType}\`${keyPart} more than once; keeping the first.`, stateName: input.stateName, modelType: model.modelType });
      continue;
    }
    seen.add(key);
    out.push(model);
  }
  return out;
}

interface FinalizeModelInput {
  readonly model: ParsedRouteModel;
  readonly stateName: string;
  readonly urlParamKeys: ReadonlySet<string>;
  readonly modelTypeSet: ReadonlySet<string> | undefined;
  readonly warnings: RouteManifestWarning[];
}

function finalizeModel(input: FinalizeModelInput): RouteManifestModelEntry {
  const { model, stateName, urlParamKeys, modelTypeSet, warnings } = input;

  for (const routeParam of model.routeParams) {
    if (!urlParamKeys.has(routeParam)) {
      warnings.push({ kind: 'unknown-route-param', severity: 'warning', message: `State \`${stateName}\` model \`${model.modelType}\` references route param \`:${routeParam}\` not present in the composed URL.`, stateName, modelType: model.modelType });
    }
  }

  if (modelTypeSet != null && !modelTypeSet.has(model.modelType)) {
    warnings.push({ kind: 'unknown-model-type', severity: 'warning', message: `State \`${stateName}\` references unknown model type \`${model.modelType}\`.`, stateName, modelType: model.modelType });
  }

  return {
    modelType: model.modelType,
    kind: model.kind,
    ...(model.keyTemplate == null ? {} : { keyTemplate: model.keyTemplate }),
    ...(model.description == null ? {} : { description: model.description })
  };
}

function modelDedupeKey(modelType: string, keyTemplate: string | undefined): string {
  return `${modelType}#${keyTemplate ?? ''}`;
}

// MARK: State entry + inheritance flatten
interface BuildStateEntryInput {
  readonly node: RouteTreeNode;
  readonly ownModelsByName: ReadonlyMap<string, readonly RouteManifestModelEntry[]>;
  readonly sources: readonly RouteSource[];
}

function buildStateEntry(input: BuildStateEntryInput): RouteManifestStateEntry {
  const { node, ownModelsByName, sources } = input;
  const models = flattenInheritedModels(node, ownModelsByName);
  const componentFile = resolveComponentFilePath(node, sources);
  const parentName = node.parent != null && !node.parent.data.futureState ? node.parent.data.name : undefined;
  const urlParamKeys = extractUrlParamKeys(node.fullUrl);

  return {
    name: node.data.name,
    ...(node.data.url == null ? {} : { url: node.data.url }),
    ...(node.fullUrl == null ? {} : { fullUrl: node.fullUrl }),
    ...(parentName == null ? {} : { parentName }),
    paramKeys: node.data.paramKeys,
    urlParamKeys,
    ...(node.data.component == null ? {} : { component: node.data.component }),
    ...(componentFile == null ? {} : { componentFile }),
    ...(node.data.abstract ? { abstract: true } : {}),
    ...(node.data.redirectTo == null ? {} : { redirectTo: node.data.redirectTo }),
    models
  };
}

function flattenInheritedModels(node: RouteTreeNode, ownModelsByName: ReadonlyMap<string, readonly RouteManifestModelEntry[]>): readonly RouteManifestModelEntry[] {
  const out: RouteManifestModelEntry[] = [...(ownModelsByName.get(node.data.name) ?? [])];
  const seen = new Set(out.map((m) => modelDedupeKey(m.modelType, m.keyTemplate)));

  let cursor: RouteTreeNode | undefined = node.parent;
  while (cursor) {
    if (!cursor.data.futureState) {
      for (const model of ownModelsByName.get(cursor.data.name) ?? []) {
        const key = modelDedupeKey(model.modelType, model.keyTemplate);
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ ...model, from: cursor.data.name });
        }
      }
    }
    cursor = cursor.parent;
  }
  return out;
}

function resolveComponentFilePath(node: RouteTreeNode, sources: readonly RouteSource[]): string | undefined {
  const component = node.data.component;
  if (component == null) {
    return undefined;
  }
  const resolved = resolveComponentSourceFromSources({ routerFile: node.data.file, component, sources });
  if (resolved == null) {
    return undefined;
  }
  return sources.some((s) => s.name === resolved.path) ? resolved.path : undefined;
}

// MARK: Missing route-model detection
/**
 * Matches an id-like route param name: anything ending in `id` or `uid`
 * (case-insensitive) — `id`, `uid`, `userId`, `workerUid`, `orgId`. These are
 * the params most likely to key a model, so an id-like URL param with no
 * `@dbxRouteModel` binding is a likely missing annotation.
 */
const ID_LIKE_ROUTE_PARAM_RE = /(?:id|uid)$/iu;

/**
 * Whether a route param name is id-like (ends in `id` / `uid`, case-insensitive).
 *
 * @param name - The route param name (without the leading `:`).
 * @returns True when the name looks like a model identifier.
 */
function isIdLikeRouteParam(name: string): boolean {
  return ID_LIKE_ROUTE_PARAM_RE.test(name);
}

/**
 * Extracts the route param names a model entry's key template references — the
 * `:name` placeholders only (the `{authUid}` placeholder is not a route param).
 *
 * @param keyTemplate - The model entry's verbatim key template, or undefined for list entries.
 * @returns The referenced route param names.
 */
function routeParamsFromKeyTemplate(keyTemplate: string | undefined): readonly string[] {
  if (keyTemplate == null) {
    return [];
  }
  return keyTemplate
    .split('/')
    .filter((segment) => segment.startsWith(':') && segment.length > 1)
    .map((segment) => segment.slice(1));
}

/**
 * Flags id-like URL params on each non-abstract state that no flattened model
 * binding covers — surfacing a `/:id`-style route that was never annotated with
 * `@dbxRouteModel`. Abstract layout states are skipped: their params are bound by
 * the concrete descendant that renders the page (and that descendant is checked).
 *
 * @param states - The flattened, name-sorted manifest state entries.
 * @param warnings - The accumulating warning list to append to.
 */
function detectMissingRouteModels(states: readonly RouteManifestStateEntry[], warnings: RouteManifestWarning[]): void {
  for (const state of states) {
    if (state.abstract) {
      continue;
    }
    const covered = new Set<string>();
    for (const model of state.models) {
      for (const param of routeParamsFromKeyTemplate(model.keyTemplate)) {
        covered.add(param);
      }
    }
    for (const param of state.urlParamKeys) {
      if (isIdLikeRouteParam(param) && !covered.has(param)) {
        warnings.push({ kind: 'missing-route-model', severity: 'warning', message: `State \`${state.name}\` has id-like route param \`:${param}\` but no \`@dbxRouteModel\` binding covers it; annotate the component class or state.`, stateName: state.name, param });
      }
    }
  }
}
