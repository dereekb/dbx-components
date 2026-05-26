/**
 * Pure tree-build + render helpers for `dbx_model_hierarchy`.
 *
 * Operates on an injected `FirebaseModel[]` so the spec can exercise tree
 * shape, depth clamping, and rendering without standing up the registry or
 * downstream catalog.
 */

import type { FirebaseModel } from '@dereekb/dbx-cli';

/**
 * Format selector for {@link buildModelHierarchy}: tree shape, flat list, or
 * both. Defaults to `'tree'` at the tool layer.
 */
export type HierarchyFormat = 'tree' | 'flat' | 'both';

/**
 * Output selector for {@link renderModelHierarchy}: pretty markdown or raw
 * JSON. Defaults to `'markdown'` at the tool layer.
 */
export type HierarchyOutput = 'markdown' | 'json';

/**
 * One node in the rendered hierarchy. Mirrors the identity-relevant subset of
 * {@link FirebaseModel} plus computed `depth` / `parent` / `children` fields.
 */
export interface HierarchyNode {
  readonly name: string;
  readonly modelType: string;
  readonly identityConst: string;
  readonly collectionPrefix: string;
  readonly collectionKind?: FirebaseModel['collectionKind'];
  readonly modelGroup?: string;
  readonly sourcePackage: string;
  readonly depth: number;
  readonly parent?: string;
  readonly children: readonly HierarchyNode[];
}

/**
 * One entry in the depth-first flat list. `parent` is the parent node's
 * `identityConst` and is absent for roots.
 */
export interface FlatHierarchyEntry {
  readonly name: string;
  readonly modelType: string;
  readonly identityConst: string;
  readonly collectionPrefix: string;
  readonly modelGroup?: string;
  readonly sourcePackage: string;
  readonly depth: number;
  readonly parent?: string;
}

/**
 * High-level summary attached to every result. Useful for callers who only
 * want a quick "what does this look like" snapshot.
 */
export interface HierarchySummary {
  readonly rootCount: number;
  readonly totalModels: number;
  readonly maxDepthReached: number;
  readonly truncatedAtDepth?: number;
}

/**
 * Result of {@link buildModelHierarchy}. `tree` and `flat` are populated per
 * the requested {@link HierarchyFormat}.
 */
export interface HierarchyResult {
  readonly summary: HierarchySummary;
  readonly tree?: readonly HierarchyNode[];
  readonly flat?: readonly FlatHierarchyEntry[];
}

/**
 * Input for {@link buildModelHierarchy}.
 */
export interface BuildHierarchyInput {
  /**
   * The pool of models to draw from. Pre-filtered by scope at the tool layer.
   */
  readonly models: readonly FirebaseModel[];
  /**
   * Optional starting model resolved by the caller. When supplied the tree is
   * a single subtree rooted at this model. When omitted every model with no
   * `parentIdentityConst` is treated as a root.
   */
  readonly rootModel?: FirebaseModel;
  /**
   * Optional max depth from the root (inclusive). `0` returns only the root
   * with empty children. Undefined means unlimited.
   */
  readonly maxDepth?: number;
  /**
   * Format to populate (`'tree'`, `'flat'`, or `'both'`). Defaults to
   * `'tree'`.
   */
  readonly format?: HierarchyFormat;
}

/**
 * Builds a forest (or single subtree) of {@link HierarchyNode}s by walking the
 * `parentIdentityConst` links present on each model. Returns the requested
 * representation(s) plus a summary block.
 *
 * @param input - The assembled call config.
 * @returns The hierarchy result honoring `format` and `maxDepth`
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildModelHierarchy(input: BuildHierarchyInput): HierarchyResult {
  const format = input.format ?? 'tree';
  const includeTree = format === 'tree' || format === 'both';
  const includeFlat = format === 'flat' || format === 'both';
  const maxDepth = input.maxDepth;

  const childrenByParent = new Map<string, FirebaseModel[]>();
  for (const model of input.models) {
    const parentKey = model.parentIdentityConst;
    if (parentKey) {
      const bucket = childrenByParent.get(parentKey) ?? [];
      bucket.push(model);
      childrenByParent.set(parentKey, bucket);
    }
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort(compareModels);
  }

  const startingModels = resolveStartingModels(input);
  const startingNodes = [...startingModels].sort(compareModels);

  let maxDepthReached = 0;
  let truncated = false;
  const tree: HierarchyNode[] = [];
  const flat: FlatHierarchyEntry[] = [];

  for (const model of startingNodes) {
    const node = walk({
      model,
      depth: 0,
      parent: undefined,
      childrenByParent,
      maxDepth,
      onDepth: (d) => {
        if (d > maxDepthReached) maxDepthReached = d;
      },
      onTruncate: () => {
        truncated = true;
      },
      flatSink: includeFlat ? flat : undefined
    });
    tree.push(node);
  }

  const summary: HierarchySummary = {
    rootCount: startingNodes.length,
    totalModels: includeFlat ? flat.length : countTreeNodes(tree),
    maxDepthReached,
    ...(truncated && maxDepth !== undefined ? { truncatedAtDepth: maxDepth } : {})
  };

  const result: HierarchyResult = {
    summary,
    ...(includeTree ? { tree } : {}),
    ...(includeFlat ? { flat } : {})
  };
  return result;
}

function resolveStartingModels(input: BuildHierarchyInput): readonly FirebaseModel[] {
  let result: readonly FirebaseModel[];
  if (input.rootModel) {
    result = [input.rootModel];
  } else {
    result = input.models.filter((m) => !m.parentIdentityConst);
  }
  return result;
}

interface WalkInput {
  readonly model: FirebaseModel;
  readonly depth: number;
  readonly parent: string | undefined;
  readonly childrenByParent: ReadonlyMap<string, readonly FirebaseModel[]>;
  readonly maxDepth: number | undefined;
  readonly onDepth: (d: number) => void;
  readonly onTruncate: () => void;
  readonly flatSink: FlatHierarchyEntry[] | undefined;
}

function walk(input: WalkInput): HierarchyNode {
  input.onDepth(input.depth);
  if (input.flatSink) {
    input.flatSink.push(toFlatEntry(input.model, input.depth, input.parent));
  }

  const atLimit = input.maxDepth !== undefined && input.depth >= input.maxDepth;
  const childModels = input.childrenByParent.get(input.model.identityConst) ?? [];
  const children: HierarchyNode[] = [];
  if (atLimit) {
    if (childModels.length > 0) input.onTruncate();
  } else {
    for (const child of childModels) {
      children.push(
        walk({
          model: child,
          depth: input.depth + 1,
          parent: input.model.identityConst,
          childrenByParent: input.childrenByParent,
          maxDepth: input.maxDepth,
          onDepth: input.onDepth,
          onTruncate: input.onTruncate,
          flatSink: input.flatSink
        })
      );
    }
  }
  return toNode({ model: input.model, depth: input.depth, parent: input.parent, children });
}

interface ToNodeInput {
  readonly model: FirebaseModel;
  readonly depth: number;
  readonly parent: string | undefined;
  readonly children: readonly HierarchyNode[];
}

function toNode(input: ToNodeInput): HierarchyNode {
  const { model, depth, parent, children } = input;
  const node: HierarchyNode = {
    name: model.name,
    modelType: model.modelType,
    identityConst: model.identityConst,
    collectionPrefix: model.collectionPrefix,
    ...(model.collectionKind ? { collectionKind: model.collectionKind } : {}),
    ...(model.modelGroup ? { modelGroup: model.modelGroup } : {}),
    sourcePackage: model.sourcePackage,
    depth,
    ...(parent ? { parent } : {}),
    children
  };
  return node;
}

function toFlatEntry(model: FirebaseModel, depth: number, parent: string | undefined): FlatHierarchyEntry {
  const entry: FlatHierarchyEntry = {
    name: model.name,
    modelType: model.modelType,
    identityConst: model.identityConst,
    collectionPrefix: model.collectionPrefix,
    ...(model.modelGroup ? { modelGroup: model.modelGroup } : {}),
    sourcePackage: model.sourcePackage,
    depth,
    ...(parent ? { parent } : {})
  };
  return entry;
}

function compareModels(a: FirebaseModel, b: FirebaseModel): number {
  let result: number;
  if (a.sourcePackage === b.sourcePackage) {
    result = a.name.localeCompare(b.name);
  } else {
    result = a.sourcePackage.localeCompare(b.sourcePackage);
  }
  return result;
}

function countTreeNodes(nodes: readonly HierarchyNode[]): number {
  let total = 0;
  for (const node of nodes) {
    total += 1 + countTreeNodes(node.children);
  }
  return total;
}

/**
 * Optional context the markdown renderer surfaces when fed by the tool layer.
 */
export interface RenderHierarchyContext {
  /**
   * The scope label used by the tool layer (`'all' | 'upstream' | 'downstream'`).
   * Surfaced verbatim in the markdown header.
   */
  readonly scope?: string;
  /**
   * The starting model identity const, when the caller restricted the tree
   * to a single subtree. Surfaced in the markdown header.
   */
  readonly rootModel?: string;
  /**
   * Echoed `maxDepth` value, when the caller supplied one. Surfaced in the
   * markdown header alongside the truncation note.
   */
  readonly maxDepth?: number;
}

/**
 * Renders a {@link HierarchyResult} as a string in the requested `output`
 * format. `'json'` is `JSON.stringify(result, null, 2)`; `'markdown'` is the
 * pretty tree + flat list combo with glyphs (`├─`, `└─`).
 *
 * @param result - Hierarchy data to render.
 * @param output - `'markdown'` (default) or `'json'`
 * @param context - Optional decorative metadata for the markdown header.
 * @returns The rendered text the tool emits as `ToolResult` content.
 */
export function renderModelHierarchy(result: HierarchyResult, output: HierarchyOutput, context?: RenderHierarchyContext): string {
  let text: string;
  if (output === 'json') {
    text = JSON.stringify(result, null, 2);
  } else {
    text = renderMarkdown(result, context);
  }
  return text;
}

function renderMarkdown(result: HierarchyResult, context: RenderHierarchyContext | undefined): string {
  const lines: string[] = ['# Firebase model hierarchy', '', buildHeaderBits(result.summary, context).join(' · ')];
  appendTruncationNote(lines, result.summary);
  appendTreeSection(lines, result.tree);
  appendFlatSection(lines, result.flat);
  return lines.join('\n').trimEnd();
}

function buildHeaderBits(summary: HierarchySummary, context: RenderHierarchyContext | undefined): string[] {
  const headerBits: string[] = [`${summary.rootCount} root${summary.rootCount === 1 ? '' : 's'}`, `${summary.totalModels} model${summary.totalModels === 1 ? '' : 's'}`, `max depth ${summary.maxDepthReached}`];
  if (context?.scope && context.scope !== 'all') headerBits.push(`scope: ${context.scope}`);
  if (context?.rootModel) headerBits.push(`from \`${context.rootModel}\``);
  if (context?.maxDepth !== undefined) headerBits.push(`maxDepth=${context.maxDepth}`);
  return headerBits;
}

function appendTruncationNote(lines: string[], summary: HierarchySummary): void {
  if (summary.truncatedAtDepth !== undefined) {
    lines.push('', `_Truncated at depth ${summary.truncatedAtDepth} — re-run with a larger \`maxDepth\` for the full subtree._`);
  }
}

function appendTreeSection(lines: string[], tree: readonly HierarchyNode[] | undefined): void {
  if (tree) {
    lines.push('', '## Tree', '');
    if (tree.length === 0) {
      lines.push('_No models matched._');
    } else {
      for (const root of tree) {
        appendTreeNode(lines, root);
      }
    }
  }
}

function appendFlatSection(lines: string[], flat: readonly FlatHierarchyEntry[] | undefined): void {
  if (flat) {
    lines.push('', `## Flat (${flat.length})`, '');
    if (flat.length === 0) {
      lines.push('_No models matched._');
    } else {
      for (const entry of flat) {
        lines.push(formatFlatEntry(entry));
      }
    }
  }
}

function formatFlatEntry(entry: FlatHierarchyEntry): string {
  const indent = TREE_INDENT.repeat(entry.depth);
  const parent = entry.parent ? ` ← \`${entry.parent}\`` : '';
  const group = entry.modelGroup ? ` _[${entry.modelGroup}]_` : '';
  return `${indent}- **${entry.name}** \`${entry.collectionPrefix}\`${group}${parent}`;
}

const TREE_INDENT = '  ';

function appendTreeNode(lines: string[], node: HierarchyNode): void {
  const indent = TREE_INDENT.repeat(node.depth);
  const group = node.modelGroup ? ` _[${node.modelGroup}]_` : '';
  const kind = node.collectionKind ? ` \`${node.collectionKind}\`` : '';
  const pkgSuffix = node.sourcePackage === '@dereekb/firebase' ? '' : ` _(${node.sourcePackage})_`;
  lines.push(`${indent}- **${node.name}** \`${node.collectionPrefix}\`${kind}${group}${pkgSuffix}`);
  for (const child of node.children) {
    appendTreeNode(lines, child);
  }
}
