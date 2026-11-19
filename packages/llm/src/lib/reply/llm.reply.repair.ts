/**
 * The deterministic reply-repair tier — decide how JSON-like a malformed reply is ({@link scoreLlmReplyJson}), fix the
 * shape slips that need no judgment ({@link repairLlmReplyJson}), and prove a repair invented and dropped nothing
 * ({@link llmReplyRepairFidelity}). Pure: no dispatcher, no I/O.
 *
 * The lenient walk itself lives in `@dereekb/util` (`repairJsonObjectText` / `scoreJsonObjectText` /
 * `checkJsonRepairFidelity`), as do the shape types it returns (`JsonRepairShape` and the other `JsonRepair*` types).
 * These wrappers add the one reply rule: the fidelity coverage check starts at the envelope's `lever` key.
 *
 * WHO CALLS IT. A dispatcher's reply-repair lane, and only on a CLEAN-STOP, object-led, JSON-protocol reply the plain
 * reader (`readLlmReplyLever`) could not read. The reader itself keeps its structural non-goal: it cannot see the
 * finish reason, so it can never tell a model that forgot its last `}` from a completion the token cap cut off. The
 * dispatcher can, which is why the decision to repair lives there.
 *
 * WHAT IS NEVER REPAIRED. A reply that ends INSIDE a string, or right after a `:`, a `,`, a bare key or an opener, is
 * `truncated-looking`: that is the signature of cut content, and no tier may invent the end of a value. Python
 * literals, unquoted keys, comments and single quotes are left to the fast fix (`makeLlmReplyFastFixer`).
 */

import { checkJsonRepairFidelity, type CheckJsonRepairFidelityConfig, JSON_REPAIR_EOF_FAULT_KINDS, type JsonRepairFaultKind, type JsonRepairFidelity, type JsonRepairResult, type JsonRepairShape, repairJsonObjectText, type RepairJsonObjectTextConfig, scoreJsonObjectText } from '@dereekb/util';

/**
 * The envelope key the fidelity coverage check starts at — the payload, not the envelope's bookkeeping.
 */
const LLM_REPLY_REPAIR_COVERAGE_KEY = 'lever';

/**
 * The repair settings every reply wrapper passes to `@dereekb/util`.
 */
const LLM_REPLY_REPAIR_CONFIG: RepairJsonObjectTextConfig = { coverageFromKey: LLM_REPLY_REPAIR_COVERAGE_KEY };

/**
 * Score and (when it is a near miss) repair one reply — the one entry point of the deterministic tier.
 *
 * Delegates to `@dereekb/util` `repairJsonObjectText`, with the coverage check starting at the `lever` key. A rebuilt
 * text that does not parse is swallow site `llm/reply-repair.rebuilt-parse` (channel `result`): the verdict carries it,
 * so no sink is called.
 *
 * @param text - The model's reply text.
 * @returns The shape, plus the repair iff the verdict is `near-miss`.
 */
export function repairLlmReplyJson(text: string): JsonRepairResult {
  return repairJsonObjectText(text, LLM_REPLY_REPAIR_CONFIG);
}

/**
 * Score one reply without keeping the repair — the shape {@link repairLlmReplyJson} computes.
 *
 * @param text - The model's reply text.
 * @returns The shape.
 */
export function scoreLlmReplyJson(text: string): JsonRepairShape {
  return scoreJsonObjectText(text, LLM_REPLY_REPAIR_CONFIG);
}

/**
 * Prove a repair invented and dropped nothing — the runtime gate on BOTH repair tiers.
 *
 * Delegates to `@dereekb/util` `checkJsonRepairFidelity`, with the coverage region taken from the `lever` key when the
 * original is an envelope.
 *
 * @param config - The original reply text and the repaired value.
 * @returns The fidelity verdict.
 */
export function llmReplyRepairFidelity(config: Pick<CheckJsonRepairFidelityConfig, 'original' | 'repaired'>): JsonRepairFidelity {
  return checkJsonRepairFidelity({ original: config.original, repaired: config.repaired, coverageFromKey: LLM_REPLY_REPAIR_COVERAGE_KEY });
}

/**
 * The plain-words reading of a fault kind, for the fixer's one-line diagnosis.
 */
const FAULT_DIAGNOSIS: Readonly<Record<JsonRepairFaultKind, string>> = {
  unclosed: 'the object ends with containers still open',
  'trailing-comma': 'a trailing comma sits before a closing bracket',
  'missing-comma': 'a comma is missing between two members',
  'mismatched-closer': 'a closing bracket does not match its opener',
  'stray-closer': 'a closing bracket has no opener',
  'control-in-string': 'a raw control character sits inside a string',
  'inner-quote': 'an unescaped quote sits inside a string',
  'trailing-prose': 'non-JSON text follows the object',
  'ends-in-string': 'the reply ends inside a string',
  dangling: 'the reply ends before a value',
  unexpected: 'an unexpected character appears where JSON syntax was expected'
};

/**
 * The fixer's one-line `[D]` diagnosis of a reply's shape — where parsing fails, and why.
 *
 * @param shape - The scorer's shape.
 * @returns One line.
 */
export function llmReplyRepairDiagnosis(shape: JsonRepairShape): string {
  const decisive = shape.faults.find((fault) => fault.kind === 'unexpected') ?? shape.faults.find((fault) => !JSON_REPAIR_EOF_FAULT_KINDS.has(fault.kind)) ?? shape.faults[0];
  const open = shape.unclosed.length;
  const containerNote = open === 1 ? 'container is' : 'containers are';
  const openNote = open === 0 ? '' : `; ${open} ${containerNote} still open there`;
  return decisive == null ? `The reply of ${shape.length} characters does not parse as JSON.` : `Parsing fails at character ${Math.min(decisive.at + 1, shape.length)} of ${shape.length}: ${FAULT_DIAGNOSIS[decisive.kind]}${openNote}.`;
}
