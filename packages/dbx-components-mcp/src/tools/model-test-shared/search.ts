/**
 * Search over the parsed `SpecFileTree`.
 *
 * Walks the tree depth-first while maintaining two stacks:
 * - `describePath` — the chain of `describe` titles ascending from the
 *   spec root.
 * - `fixtureChain` — the chain of fixture model names ascending from the
 *   spec root.
 *
 * Each query mode returns a flat list of {@link SpecSearchHit}s with both
 * stacks captured per match. Stacks describe the path *down to* the match
 * (excluding the match itself), so callers can render a search hit with
 * the full context that a test sitting at that node would inherit.
 */

import type { SpecFileTree, SpecNode, SpecSearchHit, SpecSearchQuery, SpecSearchResult } from './types.js';

/**
 * Searches a parsed spec tree against a single query. Behaviour by
 * `query.mode`:
 *
 * - `'model'` — case-insensitive equality match on every `fixture` node's
 *   {@link SpecNode.model} (e.g. `Job`).
 * - `'chain'` — case-insensitive consecutive-subsequence match against
 *   every fixture chain. The query value uses `>` as a separator
 *   (e.g. `Country > CountryState`).
 * - `'describe'` — case-insensitive substring match against every
 *   `describe` node's title.
 * - `'it'` — case-insensitive substring match against every `it` node's
 *   title.
 *
 * @param tree - the parsed spec tree
 * @param query - the search criterion
 * @returns the search hits (possibly empty)
 */
export function searchSpecTree(tree: SpecFileTree, query: SpecSearchQuery): SpecSearchResult {
  const hits: SpecSearchHit[] = [];
  const describeStack: string[] = [];
  const fixtureStack: string[] = [];
  const visit = (node: SpecNode): void => {
    matchNode(node, query, describeStack, fixtureStack, hits);
    let pushedDescribe = false;
    let pushedFixture = false;
    if (node.kind === 'describe' && node.title !== undefined) {
      describeStack.push(node.title);
      pushedDescribe = true;
    }
    if (node.kind === 'fixture' && node.model !== undefined) {
      fixtureStack.push(node.model);
      pushedFixture = true;
    }
    for (const child of node.children) {
      visit(child);
    }
    if (pushedDescribe) describeStack.pop();
    if (pushedFixture) fixtureStack.pop();
  };
  for (const child of tree.root.children) {
    visit(child);
  }
  const result: SpecSearchResult = { query, hits };
  return result;
}

function matchNode(node: SpecNode, query: SpecSearchQuery, describeStack: readonly string[], fixtureStack: readonly string[], hits: SpecSearchHit[]): void {
  let matched = false;
  switch (query.mode) {
    case 'model':
      matched = node.kind === 'fixture' && node.model !== undefined && node.model.toLowerCase() === query.value.toLowerCase();
      break;
    case 'chain':
      matched = node.kind === 'fixture' && chainContainsSequence([...fixtureStack, node.model ?? ''], parseChainQuery(query.value));
      break;
    case 'describe':
      matched = node.kind === 'describe' && node.title !== undefined && node.title.toLowerCase().includes(query.value.toLowerCase());
      break;
    case 'it':
      matched = node.kind === 'it' && node.title !== undefined && node.title.toLowerCase().includes(query.value.toLowerCase());
      break;
    default: {
      const exhaustive: never = query;
      void exhaustive;
    }
  }
  if (!matched) return;
  const hit: SpecSearchHit = {
    kind: node.kind,
    title: node.title,
    model: node.model,
    callee: node.callee,
    line: node.line,
    endLine: node.endLine,
    describePath: [...describeStack],
    fixtureChain: [...fixtureStack]
  };
  hits.push(hit);
}

/**
 * Splits a `>`-delimited chain query into its trimmed model names. Empty
 * tokens (from leading/trailing separators) are dropped.
 *
 * @param value - the raw chain query
 * @returns the parsed model names
 */
function parseChainQuery(value: string): readonly string[] {
  return value
    .split('>')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase());
}

/**
 * `true` when {@link sequence} appears as a contiguous subsequence inside
 * {@link chain} (case-insensitive). Empty sequences match everything.
 *
 * @param chain - the fixture chain (model names from root to leaf)
 * @param sequence - the parsed query sequence
 * @returns `true` when the sequence is contained in the chain
 */
function chainContainsSequence(chain: readonly string[], sequence: readonly string[]): boolean {
  if (sequence.length === 0) return true;
  if (sequence.length > chain.length) return false;
  const lowerChain = chain.map((s) => s.toLowerCase());
  outer: for (let i = 0; i <= lowerChain.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (lowerChain[i + j] !== sequence[j]) continue outer;
    }
    return true;
  }
  return false;
}
