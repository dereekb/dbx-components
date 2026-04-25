/**
 * Builds a parent-linked {@link RouteTree} from a flat list of {@link RouteNode}s.
 *
 * Linkage strategy:
 *
 *   1. Use the explicit `parent` field if present.
 *   2. Otherwise derive parent from the dot-prefix of `name`. State `a.b.c`
 *      becomes a child of `a.b`. Trailing `.**` is stripped before lookup.
 *   3. Nodes whose parent doesn't resolve are reported as orphan warnings and
 *      placed at the tree root.
 *
 * Issues surfaced:
 *
 *   - `DUPLICATE_STATE_NAME` — error; second declaration is dropped.
 *   - `CYCLE_DETECTED` — error; the cycle is broken by reverting the tail to
 *     the root list.
 *   - `ORPHAN_STATE` — warning.
 */

import type { RouteIssue, RouteNode, RouteTree, RouteTreeNode } from './types.js';

interface MutableTreeNode {
  readonly data: RouteNode;
  fullUrl: string | undefined;
  parent: MutableTreeNode | undefined;
  readonly children: MutableTreeNode[];
}

export function buildRouteTree(nodes: readonly RouteNode[], extractIssues: readonly RouteIssue[]): RouteTree {
  const issues: RouteIssue[] = [...extractIssues];
  const byName = new Map<string, MutableTreeNode>();

  // (1) Insert nodes; report duplicates
  for (const node of nodes) {
    if (byName.has(node.name)) {
      issues.push({
        code: 'DUPLICATE_STATE_NAME',
        severity: 'error',
        message: `State \`${node.name}\` is declared in multiple places. Keeping the first declaration.`,
        file: node.file,
        line: node.line,
        stateName: node.name
      });
      continue;
    }
    byName.set(node.name, { data: node, fullUrl: undefined, parent: undefined, children: [] });
  }

  // (2) Wire parent links
  for (const treeNode of byName.values()) {
    const parentName = resolveParentName(treeNode.data, byName);
    if (!parentName) {
      continue;
    }
    const parent = byName.get(parentName);
    if (!parent) {
      issues.push({
        code: 'ORPHAN_STATE',
        severity: 'warning',
        message: `State \`${treeNode.data.name}\` references parent \`${parentName}\` which is not declared in the analyzed sources.`,
        file: treeNode.data.file,
        line: treeNode.data.line,
        stateName: treeNode.data.name
      });
      continue;
    }
    treeNode.parent = parent;
    parent.children.push(treeNode);
  }

  // (3) Detect cycles. A cycle is impossible via dot-prefix linkage but the
  // explicit `parent` field can introduce one (`a.parent = 'b'`,
  // `b.parent = 'a'`). Walk from each node and break the chain on revisits.
  for (const treeNode of byName.values()) {
    if (!treeNode.parent) {
      continue;
    }
    const seen = new Set<string>();
    seen.add(treeNode.data.name);
    let cursor: MutableTreeNode | undefined = treeNode.parent;
    while (cursor) {
      if (seen.has(cursor.data.name)) {
        issues.push({
          code: 'CYCLE_DETECTED',
          severity: 'error',
          message: `Cycle detected involving \`${treeNode.data.name}\` and \`${cursor.data.name}\`. Severing the parent link.`,
          file: treeNode.data.file,
          line: treeNode.data.line,
          stateName: treeNode.data.name
        });
        // Detach from parent — sever the edge that would loop back.
        if (treeNode.parent) {
          const idx = treeNode.parent.children.indexOf(treeNode);
          if (idx >= 0) {
            treeNode.parent.children.splice(idx, 1);
          }
          treeNode.parent = undefined;
        }
        break;
      }
      seen.add(cursor.data.name);
      cursor = cursor.parent;
    }
  }

  // (4) Compose full URLs (parent walk; root url is not prefixed). UIRouter's
  // own logic is more nuanced (some states overwrite their parent's URL with
  // a leading `^`), but this gives a useful approximation for the common case.
  for (const treeNode of byName.values()) {
    treeNode.fullUrl = composeFullUrl(treeNode);
  }

  // (5) Identify roots
  const roots: MutableTreeNode[] = [];
  for (const treeNode of byName.values()) {
    if (!treeNode.parent) {
      roots.push(treeNode);
    }
  }

  // (6) Sort children deterministically by name
  for (const treeNode of byName.values()) {
    treeNode.children.sort(compareByName);
  }
  roots.sort(compareByName);

  // (7) Freeze: convert MutableTreeNode → RouteTreeNode (children: readonly).
  const frozen = new Map<string, RouteTreeNode>();
  const freeze = (mut: MutableTreeNode): RouteTreeNode => {
    const existing = frozen.get(mut.data.name);
    if (existing) {
      return existing;
    }
    const placeholder: { -readonly [K in keyof RouteTreeNode]: RouteTreeNode[K] } = {
      data: mut.data,
      fullUrl: mut.fullUrl,
      parent: undefined,
      children: []
    };
    frozen.set(mut.data.name, placeholder as RouteTreeNode);
    placeholder.parent = mut.parent ? freeze(mut.parent) : undefined;
    placeholder.children = mut.children.map(freeze);
    return placeholder as RouteTreeNode;
  };

  const frozenRoots = roots.map(freeze);

  const result: RouteTree = {
    roots: frozenRoots,
    byName: frozen,
    issues,
    filesChecked: 0,
    nodeCount: byName.size
  };
  return result;
}

function resolveParentName(node: RouteNode, byName: ReadonlyMap<string, MutableTreeNode>): string | undefined {
  if (node.explicitParent) {
    return node.explicitParent;
  }
  const lookupName = node.name.endsWith('.**') ? node.name.slice(0, -3) : node.name;
  const lastDot = lookupName.lastIndexOf('.');
  if (lastDot < 0) {
    return undefined;
  }
  const candidate = lookupName.slice(0, lastDot);
  // Confirm the candidate exists; otherwise fall back to undefined so the
  // orphan check fires.
  if (byName.has(candidate)) {
    return candidate;
  }
  // Even if the candidate doesn't exist, return it so the orphan logic can
  // surface an informative message.
  return candidate;
}

function composeFullUrl(node: MutableTreeNode): string | undefined {
  const segments: string[] = [];
  let cursor: MutableTreeNode | undefined = node;
  while (cursor) {
    if (cursor.data.url !== undefined) {
      segments.unshift(cursor.data.url);
    }
    cursor = cursor.parent;
  }
  if (segments.length === 0) {
    return undefined;
  }
  // Join segments and collapse double slashes (root url '/' followed by
  // child '/foo' would otherwise yield '//foo').
  const joined = segments.join('');
  const collapsed = joined.replace(/\/{2,}/g, '/');
  return collapsed.length === 0 ? '/' : collapsed;
}

function compareByName(a: { readonly data: RouteNode }, b: { readonly data: RouteNode }): number {
  if (a.data.name < b.data.name) {
    return -1;
  }
  if (a.data.name > b.data.name) {
    return 1;
  }
  return 0;
}
