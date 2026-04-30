/**
 * Auto-attached remediation lookup used by every domain's
 * `pushViolation` helper. Returns a `RemediationHint` (or `undefined`
 * when no catalog entry exists) populated from the rule catalog.
 *
 * The hint is the structured form rendered as a nested bullet block
 * under each violation by the per-domain markdown formatters and
 * surfaced as-is by the JSON formatters.
 */

import { findRule } from './find.js';
import type { RemediationHint } from './types.js';

/**
 * Builds the auto-attach hint for a violation by looking up its
 * catalog entry. Returns `undefined` when no rule matches the code —
 * keeps the violation valid (the caller treats `remediation`
 * as optional) so unmapped codes don't blow up the formatter.
 *
 * @param code - the violation code emitted by the rule
 * @returns the populated hint, or `undefined` when no rule matches
 */
export function attachRemediation(code: string): RemediationHint | undefined {
  const rule = findRule(code);
  if (!rule) return undefined;
  const hint: RemediationHint = {
    fix: rule.canonicalFix,
    template: rule.canonicalFixTemplate,
    seeAlso: rule.seeAlso
  };
  return hint;
}
