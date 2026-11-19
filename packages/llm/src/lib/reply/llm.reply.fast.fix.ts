/**
 * The fast-fix seam: types, the capability key and the lane limits, so the dispatcher imports no capability; the fixer
 * is `makeLlmReplyFastFixer` (`capability/llm.capability.repair.reply.json.ts`). The fast fix is one cheap model call
 * that repairs a mangled JSON reply the deterministic tier (`repairLlmReplyJson`) could not. A host injects an
 * {@link LlmReplyFastFixer} into its dispatcher's config; the dispatcher hands it the broken reply, the scorer's
 * `JsonRepairShape` (`@dereekb/util`) of it, and its own dispatch.
 */

import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmCapabilityKey } from '../model/llm.value';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallMeta, type LlmDispatchResult } from '../strategy/llm.strategy';
import { type JsonRepairShape } from '@dereekb/util';

/**
 * The fast-fix capability's key. Unchanged from the source because call records, tapes and censuses key on it; declared
 * here so a dispatcher's recursion guard (never fast-fix the fixer) imports no capability.
 */
export const LLM_REPAIR_REPLY_JSON_CAPABILITY: LlmCapabilityKey = 'RepairReplyJson';

/**
 * The limits of a dispatcher's fast-fix lane.
 */
export interface LlmReplyFastFixLimits {
  /**
   * The lowest score a `mangled` reply may carry and still be handed to the fast fix — at least half the object is valid
   * JSON before the first fault, so the fixer corrects a slip rather than reconstructing a reply.
   */
  readonly minScore: number;
  /**
   * The longest reply the fast fix is handed (chars).
   */
  readonly maxChars: number;
  /**
   * How many fast-fix calls one subject dispatch may make.
   */
  readonly maxPerDispatch: number;
}

/**
 * The default fast-fix lane limits — a score of at least 0.5, at most 16,000 chars, one fix per subject dispatch.
 */
export const DEFAULT_LLM_REPLY_FAST_FIX_LIMITS: LlmReplyFastFixLimits = { minScore: 0.5, maxChars: 16_000, maxPerDispatch: 1 };

/**
 * The input the dispatcher hands an {@link LlmReplyFastFixer}. The dispatcher supplies the per-attempt facts; the
 * host's fixer builds its own request from the subject {@link request}.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 */
export interface LlmReplyFastFixInput<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * The SUBJECT request whose reply is broken — a host builds its fixer's own request from it (its host fields, its
   * `meta`).
   */
  readonly request: R;
  /**
   * The capability whose reply is broken.
   */
  readonly subjectCapability: LlmCapabilityKey;
  /**
   * The broken reply text (the model's bytes).
   */
  readonly text: string;
  /**
   * The scorer's shape of it.
   */
  readonly shape: JsonRepairShape;
  /**
   * The subject's resolved lever schema — the fixer's per-invocation `responseSchemaHint`.
   */
  readonly schemaHint: unknown;
  /**
   * The 1-based subject attempt whose reply is broken.
   */
  readonly attempt: number;
  /**
   * The subject attempt's call context (the fixer's call nests under it).
   */
  readonly callContext: LlmCallContext;
  /**
   * The dispatcher's own dispatch — the fixer is an ordinary capability call.
   */
  readonly dispatch: (request: R) => Promise<X>;
}

/**
 * Why a fast fix did not produce a usable lever.
 */
export type LlmReplyFastFixMissReason = 'unusable' | 'fidelity' | 'truncated' | 'declined' | 'error';

/**
 * The outcome of one fast fix.
 *
 * Each arm may carry `meta` — host data of the fixer's own call (e.g. its correlation id), echoed so a host can stamp
 * it on the repair it records; the library never reads it.
 */
export type LlmReplyFastFixOutcome =
  | {
      /**
       * The fix produced a usable lever.
       */
      readonly kind: 'fixed';
      /**
       * The corrected lever.
       */
      readonly lever: Readonly<Record<string, unknown>>;
      /**
       * The corrected lever as JSON text (what substitutes into the dispatch result's `text`).
       */
      readonly text: string;
      /**
       * Host data of the fixer's own call.
       */
      readonly meta?: LlmCallMeta;
    }
  | {
      /**
       * The fix did not produce a usable lever.
       */
      readonly kind: 'missed';
      /**
       * Why ({@link LlmReplyFastFixMissReason}).
       */
      readonly reason: LlmReplyFastFixMissReason;
      /**
       * Host data of the fixer's own call.
       */
      readonly meta?: LlmCallMeta;
    };

/**
 * The fast-fix seam a host injects into its dispatcher's config.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 */
export type LlmReplyFastFixer<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult> = (input: LlmReplyFastFixInput<R, X>) => Promise<LlmReplyFastFixOutcome>;
