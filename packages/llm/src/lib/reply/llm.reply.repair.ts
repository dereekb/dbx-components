/**
 * The deterministic reply-repair tier — decide how JSON-like a malformed reply is ({@link scoreLlmReplyJson}), fix the
 * shape slips that need no judgment ({@link repairLlmReplyJson}), and prove a repair invented and dropped nothing
 * ({@link llmReplyRepairFidelity}). Pure: no dispatcher, no I/O.
 *
 * The lenient walk itself lives in `@dereekb/util` (`repairJsonObjectText` / `scoreJsonObjectText` /
 * `checkJsonRepairFidelity`), as do the shape types it returns (`JsonRepairShape` and the other `JsonRepair*` types).
 * These wrappers add the one reply rule: on a `json-envelope` reply the fidelity coverage check is taken over the
 * envelope lever key's value (its balanced object), so the envelope's bookkeeping never counts; on a `json` reply the
 * whole reply is the payload.
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

import { checkJsonRepairFidelity, type CheckJsonRepairFidelityConfig, JSON_REPAIR_EOF_FAULT_KINDS, type JsonRepairFaultKind, type JsonRepairFidelity, type JsonRepairResult, type JsonRepairShape, type Maybe, repairJsonObjectText, scoreJsonObjectText } from '@dereekb/util';
import { type LlmReplyEnvelopeKeys } from './llm.reply.envelope';

/**
 * How a reply wrapper scopes its fidelity coverage.
 */
export interface LlmReplyRepairConfig {
  /**
   * The reply's envelope keys when it reads as `json-envelope` — coverage is taken over the `lever` key's value. Absent ⇒ the whole reply is the payload.
   */
  readonly envelope?: Maybe<LlmReplyEnvelopeKeys>;
}

/**
 * Score and (when it is a near miss) repair one reply — the one entry point of the deterministic tier.
 *
 * Delegates to `@dereekb/util` `repairJsonObjectText`, with the coverage check taken over the envelope's lever value
 * when `config.envelope` is set. A rebuilt text that does not parse is swallow site `llm/reply-repair.rebuilt-parse`
 * (channel `result`): the verdict carries it, so no sink is called.
 *
 * @param text - The model's reply text.
 * @param config - The reply's reading envelope, when it is a `json-envelope` reply.
 * @returns The shape, plus the repair iff the verdict is `near-miss`.
 */
export function repairLlmReplyJson(text: string, config?: Maybe<LlmReplyRepairConfig>): JsonRepairResult {
  return repairJsonObjectText(text, { coverageFromKey: config?.envelope?.lever });
}

/**
 * Score one reply without keeping the repair — the shape {@link repairLlmReplyJson} computes.
 *
 * @param text - The model's reply text.
 * @param config - The reply's reading envelope, when it is a `json-envelope` reply.
 * @returns The shape.
 */
export function scoreLlmReplyJson(text: string, config?: Maybe<LlmReplyRepairConfig>): JsonRepairShape {
  return scoreJsonObjectText(text, { coverageFromKey: config?.envelope?.lever });
}

/**
 * Configures {@link llmReplyRepairFidelity}.
 */
export interface LlmReplyRepairFidelityConfig extends Pick<CheckJsonRepairFidelityConfig, 'original' | 'repaired'>, LlmReplyRepairConfig {}

/**
 * Prove a repair invented and dropped nothing — the runtime gate on BOTH repair tiers.
 *
 * Delegates to `@dereekb/util` `checkJsonRepairFidelity`, with the coverage region taken over the envelope's lever
 * value (its balanced object) when `config.envelope` is set; otherwise the whole original is checked.
 *
 * @param config - The original reply text, the repaired value and the original's reading envelope.
 * @returns The fidelity verdict.
 */
export function llmReplyRepairFidelity(config: LlmReplyRepairFidelityConfig): JsonRepairFidelity {
  return checkJsonRepairFidelity({ original: config.original, repaired: config.repaired, coverageFromKey: config.envelope?.lever });
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
