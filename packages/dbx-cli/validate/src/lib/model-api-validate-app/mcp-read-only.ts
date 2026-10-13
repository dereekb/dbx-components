/**
 * MCP read/write classification check for `dbx_model_api_validate_app`.
 *
 * MCP infers whether a handler reads or writes from its call type: `read`/`query` read and `create`/`update`/`delete`
 * write. Every other call type (`invoke`, custom verbs) is a write unless the handler's `withApiDetails({ ... })`
 * declares `mcp.readOnly`, so a pure-read invoke that forgets the flag silently becomes a write. This check warns about
 * every such handler that leaves it unset (`HANDLER_MCP_READ_ONLY_UNSET`).
 */

import type { Maybe } from '@dereekb/util';
import type { HandlerEntry, ValidateIssue } from './types.js';

/**
 * Call types whose MCP read/write classification is inferred when a handler leaves `mcp.readOnly` unset: `read`/`query`
 * → read, `create`/`update`/`delete` → write. Mirrors `READ_ONLY_BY_CALL_TYPE` / `resolveEffectiveReadOnly` in
 * `@dereekb/firebase-server/mcp` (`mcp.visibility.ts`) — keep the two in sync. Every other call type (`invoke`, custom
 * verbs) is a write unless the handler declares `mcp.readOnly`.
 */
export const MCP_READ_ONLY_INFERRED_VERBS: ReadonlySet<string> = new Set(['read', 'query', 'create', 'update', 'delete']);

/**
 * Whether MCP infers a handler's read/write classification from its call type.
 *
 * @param verb - The call type the handler is wired under.
 * @returns `true` for `read`/`query`/`create`/`update`/`delete`, `false` for `invoke` and custom verbs.
 */
export function isMcpReadOnlyInferredVerb(verb: string): boolean {
  return MCP_READ_ONLY_INFERRED_VERBS.has(verb);
}

/**
 * Returns a `HANDLER_MCP_READ_ONLY_UNSET` warning when a handler whose call type leaves the MCP read/write
 * classification to it (`invoke`, custom verbs) has a `withApiDetails({ ... })` declaration without `mcp.readOnly`.
 *
 * @param handler - The discovered handler entry.
 * @returns The warning, or `undefined` when the handler declares `mcp.readOnly`, its call type decides, or the scan could not read its declaration.
 */
export function checkHandlerMcpReadOnly(handler: HandlerEntry): Maybe<ValidateIssue> {
  const status = handler.mcpReadOnly;
  let result: Maybe<ValidateIssue>;
  if (status?.kind === 'unset' && !isMcpReadOnlyInferredVerb(handler.verb)) {
    const specifierSuffix = handler.specifier ? `.${handler.specifier}` : '';
    const where = `\`${status.declarationSource}\``;
    const found = status.hasMcp ? `has an \`mcp\` block without \`readOnly\` in its \`withApiDetails({ ... })\` (${where})` : `has no \`mcp\` block in its \`withApiDetails({ ... })\` (${where})`;
    const fix = status.hasMcp ? 'Add `readOnly: true` if it only reads, or `readOnly: false` if it writes, with a short comment saying why.' : 'Declare `mcp: { readOnly: true }` if it only reads, or `mcp: { readOnly: false }` if it writes, with a short comment saying why.';
    result = {
      code: 'HANDLER_MCP_READ_ONLY_UNSET',
      severity: 'warning',
      model: handler.model,
      verb: handler.verb,
      specifier: handler.specifier,
      message: `Handler \`${handler.handlerName}\` for \`${handler.model}.${handler.verb}${specifierSuffix}\` ${found}, so MCP classifies the \`${handler.verb}\` as a write by default: it is only callable through the write tool, is advertised \`destructiveHint: true\`, and is dropped in read-only mode. ${fix}`,
      source: status.declarationSource
    };
  }
  return result;
}
