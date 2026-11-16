/**
 * The **retry LEVER LADDER** — the pure chooser that answers the one question a bounded retry loop must answer
 * before it pays for another attempt: *what will be DIFFERENT about the next attempt?*
 *
 * Without it, the common retry — a schema-validation miss, a critique rejection, or a decode failure on a host that
 * configured no escalation tier — re-asks the IDENTICAL model at the IDENTICAL budget with the IDENTICAL volatile
 * suffix and the IDENTICAL reasoning setting, differing only in a trailing correction paragraph, and pays a full
 * billed completion for an outcome that was already largely determined.
 *
 * THE RULE THIS ENCODES: **a semantic retry changes ONE lever and says which** — and *a rung's own COST is part of
 * the rung, not a second lever*. Reasoning tokens are drawn FROM `maxOutputTokens`, so asking a model to think at an
 * unchanged cap is asking it for LESS ANSWER: dropped `length-capped` / `reasoning-only` dispatches cluster on the
 * attempt AFTER a `reasoning-low` retry. So `reasoning-low` buys its own completion headroom
 * ({@link LLM_RETRY_REASONING_LOW_HEADROOM_FACTOR}) as part of its application: the `lever` stays `'reasoning-low'`,
 * `from`/`to` stay `'off'`/`'low'`, and the raise is stated out loud in the rung's own `reason` and carried on
 * {@link LlmRetryLever.headroom} rather than hidden.
 *
 * {@link chooseLlmRetryLever} walks a fixed, failure-class-keyed ladder and returns the first rung that would actually
 * change a sent byte; {@link applyLlmRetryLever} is the only place a chosen rung touches the request. A rung that
 * cannot change anything (an escalation model equal to the model that just failed, a budget already at the ceiling, a
 * reasoning flip on a gateway that rejects the param) is UNAVAILABLE and is skipped — which is what keeps the decision
 * honest on a tier map that pins two tiers to one slug, where an "escalated" retry would otherwise be the same model
 * wearing a different label.
 *
 * `lever: 'none'` is a legitimate, RECORDED outcome (the transport lane, and a genuinely exhausted ladder) — it
 * carries the reason naming which rungs were unavailable, so a retry that changes nothing describes a decision rather
 * than a regret.
 *
 * Pure: no I/O, no clock, no environment. The dispatcher's bounded retry loop is its one consumer.
 */

import type { LlmModelId, LlmReasoningConfig } from '../model/llm.value';
import type { LlmRetryCause } from '../record/llm.decode.failure';
import type { LlmRequest } from '../strategy/llm.strategy';

/**
 * WHICH lever a retry moves — the closed set of things a dispatcher can change between two attempts of one dispatch,
 * plus the honest `'none'`.
 *
 * - `budget` — raise `maxOutputTokens` (×4, clamped to the ceiling). The ONLY rung that PERSISTS for every remaining
 *   attempt (a bigger cap is a re-ask ceiling, not a per-attempt spike) and therefore the only one that may be picked
 *   more than once in a dispatch: each pick sends a different number.
 * - `model` — re-roll on the configured decode-retry tier's slug. Available ONLY when that slug DIFFERS from the one
 *   the failing attempt used.
 * - `reasoning-off` — flip a reasoning-ON dispatch off. The lever for a reply that spent its whole completion on
 *   invisible reasoning and for a client-deadline timeout.
 * - `reasoning-low` — flip a reasoning-OFF dispatch to `{ enabled: true, effort: 'low' }`. The lever for a reply that
 *   decoded fine but got the ANSWER wrong (a schema miss, a critic rejection): more thinking, not a different model.
 * - `structured-off` — drop `responseSchemaHint` (hence `response_format: json_schema/strict`) for the re-ask, for a
 *   model that produces better free-form JSON than constrained JSON.
 * - `none` — nothing would change a sent byte. The transport lane's identical, cache-hot resend, and the floor of
 *   every ladder.
 */
export type LlmRetryLeverKind = 'budget' | 'model' | 'reasoning-off' | 'reasoning-low' | 'structured-off' | 'none';

/**
 * The ONE lever a retry moves, rendered for the log and for the persisted attempt phase.
 */
export interface LlmRetryLever {
  /**
   * The rung this retry takes.
   */
  readonly lever: LlmRetryLeverKind;
  /**
   * The value the FAILED attempt carried, rendered (`'4096'`, `'x/flash'`, `'off'`, `'strict'`).
   */
  readonly from: string;
  /**
   * The value the RETRY will carry. Equals {@link from} only for `lever: 'none'`.
   */
  readonly to: string;
  /**
   * WHY this rung was picked — and, for `'none'`, why every rung above it was unavailable.
   */
  readonly reason: string;
  /**
   * The completion cap this rung raises `maxOutputTokens` to, when the rung's own cost requires one. Set ONLY by
   * `reasoning-low` and only when the failed attempt's budget was below the ceiling; omitted otherwise, so every
   * other rung's rendered lever and persisted phase are byte-identical.
   */
  readonly headroom?: number;
  /**
   * The rung whose OWN failure this lever undoes — set only on the BONUS attempt a dispatcher grants when the final
   * attempt was cap-ended by the `reasoning-low` rung it had just taken (`induced: 'reasoning-low'`,
   * `lever: 'reasoning-off'`). Absent on every ladder-chosen lever.
   */
  readonly induced?: LlmRetryLeverKind;
}

/**
 * The inputs {@link chooseLlmRetryLever} decides from — everything about the FAILED attempt that a rung's
 * availability depends on. Pure data: the chooser reads no strategy, no config and no clock.
 */
export interface ChooseLlmRetryLeverInput {
  /**
   * Why the attempt is being retried.
   */
  readonly cause: LlmRetryCause;
  /**
   * Whether the provider's completion CAP ended the reply (`isLlmLengthCappedFinish`) — read APART from
   * {@link cause}, because a reasoning-tier reply that burns the whole cap before emitting a visible character
   * classifies `empty-result` while being truncation in its worst form.
   */
  readonly lengthCapped: boolean;
  /**
   * Whether the reply was REASONING-ONLY — blank visible text with billed reasoning tokens. The always-thinking shape,
   * and the one `empty-result` whose fix is to turn reasoning off rather than to change model.
   */
  readonly reasoningOnly: boolean;
  /**
   * The concrete slug the failed attempt RESOLVED to — never the request-shaped `model`, which is elided when it
   * equals the default tier's slug and would make every comparison read as a change.
   */
  readonly model: LlmModelId;
  /**
   * The concrete slug the decode-retry tier resolves to. Omitted ⇒ no escalation is configured at all; EQUAL to
   * {@link model} ⇒ configured but inert (a tier map that pins two tiers to one slug), which is exactly the case the
   * `model` rung must refuse rather than announce.
   */
  readonly escalateModel?: LlmModelId;
  /**
   * Whether the failed attempt's RESOLVED reasoning was ON (`reasoning.enabled !== false`).
   */
  readonly reasoningEnabled: boolean;
  /**
   * Whether the serving strategy accepts a reasoning parameter at all (`LlmStrategy.supportsReasoningParam`).
   * `false` ⇒ BOTH reasoning rungs are unavailable, because sending one to a gateway that rejects it turns a
   * recoverable retry into a thrown dispatch.
   */
  readonly reasoningSupported: boolean;
  /**
   * Whether the failed attempt sent a `responseSchemaHint` (hence structured-output enforcement).
   */
  readonly structured: boolean;
  /**
   * The completion budget the failed attempt was sent with.
   */
  readonly outputBudget: number;
  /**
   * The absolute ceiling the budget rung may raise to.
   */
  readonly budgetCeiling: number;
  /**
   * The rungs already SPENT earlier in this dispatch — never re-picked, so a host that raised its attempt cap walks
   * DOWN the ladder instead of repeating one move. `budget` is deliberately exempt (see {@link LlmRetryLeverKind}):
   * each pick sends a strictly larger number, so re-picking it does change a byte.
   */
  readonly spent: ReadonlySet<LlmRetryLeverKind>;
}

/**
 * The factor the `budget` rung multiplies the failed attempt's completion cap by.
 */
export const LLM_RETRY_BUDGET_RAISE_FACTOR = 4;

/**
 * The reasoning band the `reasoning-low` rung flips a reasoning-OFF dispatch to — deliberately the LOWEST band,
 * because the rung exists to buy a little deliberation on the second attempt of a failing dispatch, not to re-price
 * the capability.
 */
export const LLM_RETRY_REASONING_LOW: LlmReasoningConfig = { enabled: true, effort: 'low' };

/**
 * The factor the `reasoning-low` rung raises the failed attempt's completion cap by, as part of taking the rung.
 *
 * Deliberately 2, not the `budget` rung's {@link LLM_RETRY_BUDGET_RAISE_FACTOR} of 4: two doublings would bill 4× on
 * a capability whose typical completion is a small fraction of the cap. 2× gives the reasoning its own budget and
 * leaves the original budget for the answer, which is the whole of the cap the attempt before it was working with.
 */
export const LLM_RETRY_REASONING_LOW_HEADROOM_FACTOR = 2;

/**
 * The reasoning config the `reasoning-off` rung flips to (a dispatcher's own OFF floor, restated here so this module
 * imports nothing from the dispatcher it serves).
 */
export const LLM_RETRY_REASONING_OFF: LlmReasoningConfig = { enabled: false };

/**
 * The ladder each cause walks, first APPLICABLE rung wins. A `lengthCapped` reply overrides its class's ladder with
 * the truncation one, because "the cap ended it" is a stronger statement about what to change than "the reader could
 * not parse it".
 */
const RETRY_LADDER: Readonly<Record<LlmRetryCause, ReadonlyArray<LlmRetryLeverKind>>> = {
  // The cap ended the reply: give it room, then a different model, then drop the grammar constraint that may be
  // padding it.
  'length-truncation': ['budget', 'model', 'structured-off'],
  // No text at all. `reasoningOnly` re-routes this below — a genuinely blank reply is a model problem first.
  'empty-result': ['model', 'reasoning-low'],
  // Strict decoding already failed, so a different model first, then dropping the constraint, then thinking.
  'parse-error': ['model', 'structured-off', 'reasoning-low'],
  // The reply DECODED and did not conform: the answer was wrong, so buy deliberation before buying a model.
  'schema-validation': ['reasoning-low', 'model'],
  // A critic rejected a well-formed answer — same shape as a schema miss.
  critique: ['reasoning-low', 'model'],
  // TRANSPORT. A client deadline says nothing about the model's competence, so the ONLY rung is the one that
  // addresses the actual cause: hidden reasoning, the usual latency killer.
  timeout: ['reasoning-off'],
  // TRANSPORT, the other half: the call never reached the model (connection reset, rate limit, gateway 5xx).
  // NO rung applies — every lever here changes what we ASK, and nothing was asked. The only useful response is
  // to wait and resend the identical, cache-hot bytes, which a dispatcher's backoff does before this returns
  // `lever: 'none'`. Moving a lever would additionally destroy the prompt-cache hit on the re-ask for nothing.
  transport: []
};

/**
 * The truncation ladder, applied to ANY cause whose reply the completion cap ended.
 */
const LENGTH_CAPPED_LADDER: ReadonlyArray<LlmRetryLeverKind> = RETRY_LADDER['length-truncation'];

/**
 * The ladder a REASONING-ONLY empty reply walks — turn the invisible thinking off before anything else, since that
 * is where the whole completion went.
 */
const REASONING_ONLY_LADDER: ReadonlyArray<LlmRetryLeverKind> = ['reasoning-off', 'budget', 'model'];

/**
 * Render one rung's `from` / `to` pair, or `undefined` when the rung cannot change a sent byte for this input.
 *
 * @param rung - The rung to price.
 * @param input - The failed attempt's facts.
 * @returns The rendered move, or `undefined` when the rung is unavailable.
 */
function priceRung(rung: LlmRetryLeverKind, input: ChooseLlmRetryLeverInput): { readonly from: string; readonly to: string; readonly reason: string; readonly headroom?: number } | undefined {
  let priced: { readonly from: string; readonly to: string; readonly reason: string; readonly headroom?: number } | undefined;

  switch (rung) {
    case 'budget': {
      if (input.outputBudget < input.budgetCeiling) {
        const raised = Math.min(input.budgetCeiling, input.outputBudget * LLM_RETRY_BUDGET_RAISE_FACTOR);
        priced = { from: String(input.outputBudget), to: String(raised), reason: 'the completion cap ended the reply, so the re-ask gets room to finish' };
      }

      break;
    }
    case 'model': {
      // The comparison is against the RESOLVED slug: a configured tier that resolves to the model which just
      // failed is not an escalation, and announcing it as one is worse than admitting there is nothing to move.
      if (input.escalateModel != null && input.escalateModel !== input.model) {
        priced = { from: input.model, to: input.escalateModel, reason: 'the decode-retry tier resolves to a different slug than the one that just failed' };
      }

      break;
    }
    case 'reasoning-off': {
      if (input.reasoningSupported && input.reasoningEnabled) {
        priced = { from: 'on', to: 'off', reason: 'the attempt reasoned and the reply never arrived, so the re-ask spends its completion on the answer' };
      }

      break;
    }
    case 'reasoning-low': {
      if (input.reasoningSupported && !input.reasoningEnabled) {
        // THE RUNG BUYS ITS OWN ROOM. Reasoning is drawn from the completion cap, so raising the band without
        // raising the cap asks for less answer than the attempt that just failed had — and that is measurably
        // how this rung cap-ends a share of the dispatches it is taken on.
        const headroom = input.outputBudget < input.budgetCeiling ? Math.min(input.budgetCeiling, input.outputBudget * LLM_RETRY_REASONING_LOW_HEADROOM_FACTOR) : undefined;
        priced = {
          from: 'off',
          to: 'low',
          reason:
            headroom == null
              ? 'the reply decoded but got the answer wrong, so the re-ask buys a low reasoning band rather than a different model'
              : `the reply decoded but got the answer wrong, so the re-ask buys a low reasoning band rather than a different model, with the completion cap raised ${input.outputBudget} → ${headroom} so the thinking does not eat the answer`,
          ...(headroom == null ? {} : { headroom })
        };
      }

      break;
    }
    case 'structured-off': {
      if (input.structured) {
        priced = { from: 'strict', to: 'free', reason: 'strict structured output already failed on this reply, so the re-ask drops the grammar constraint' };
      }

      break;
    }
    case 'none':
      break;
  }

  return priced;
}

/**
 * WHY a rung was unavailable, for the `'none'` reason string. One clause per rung, so an exhausted ladder says what
 * it looked at rather than only that it found nothing.
 *
 * @param rung - The rung that was skipped.
 * @param input - The failed attempt's facts.
 * @returns The clause.
 */
function unavailableBecause(rung: LlmRetryLeverKind, input: ChooseLlmRetryLeverInput): string {
  let clause: string;

  switch (rung) {
    case 'budget':
      clause = input.spent.has('budget') ? 'budget already spent' : `budget already at the ${input.budgetCeiling} ceiling`;
      break;
    case 'model':
      if (input.escalateModel == null) {
        clause = 'no decode-retry tier resolves';
      } else if (input.spent.has('model')) {
        clause = 'model already escalated';
      } else {
        clause = `the decode-retry tier resolves to the same slug (${input.model})`;
      }

      break;
    case 'reasoning-off':
      if (!input.reasoningSupported) {
        clause = 'the provider rejects reasoning params';
      } else if (input.spent.has('reasoning-off')) {
        clause = 'reasoning already turned off';
      } else {
        clause = 'reasoning is already off';
      }

      break;
    case 'reasoning-low':
      if (!input.reasoningSupported) {
        clause = 'the provider rejects reasoning params';
      } else if (input.spent.has('reasoning-low')) {
        clause = 'reasoning already raised';
      } else {
        clause = 'reasoning is already on';
      }

      break;
    case 'structured-off':
      clause = input.spent.has('structured-off') ? 'structured output already dropped' : 'the attempt sent no response schema';
      break;
    case 'none':
      clause = 'nothing left';
      break;
  }

  return clause;
}

/**
 * Choose the ONE lever this retry moves. Walks the ladder for the cause (overridden by the truncation /
 * reasoning-only ladders when the reply says so) and returns the first rung that would actually change a sent byte,
 * skipping any rung already spent this dispatch (`budget` excepted — each pick sends a strictly larger cap).
 *
 * PURE and total: it always returns a lever, and `'none'` carries the clause naming why every rung above it was
 * unavailable, so a retry that changes nothing is a recorded decision rather than a silent repetition.
 *
 * @param input - The failed attempt's facts.
 * @returns The chosen lever.
 */
export function chooseLlmRetryLever(input: ChooseLlmRetryLeverInput): LlmRetryLever {
  // REASONING-ONLY outranks LENGTH-CAPPED: a reply that spent its whole completion on invisible thinking is
  // length-capped too, and raising the cap just buys more thinking. Turn the thinking off first; the truncation
  // ladder is the right answer for every other cap-ended reply.
  let ladder: ReadonlyArray<LlmRetryLeverKind>;

  if (input.reasoningOnly && input.cause === 'empty-result') {
    ladder = REASONING_ONLY_LADDER;
  } else if (input.lengthCapped) {
    ladder = LENGTH_CAPPED_LADDER;
  } else {
    ladder = RETRY_LADDER[input.cause] ?? [];
  }

  const skipped: string[] = [];
  let chosen: LlmRetryLever | undefined;

  for (const rung of ladder) {
    // `budget` is the one repeatable rung — a second raise sends a different number, so "already spent" does not
    // make it inert the way a second identical model swap would be.
    const spent = rung !== 'budget' && input.spent.has(rung);
    const priced = spent ? undefined : priceRung(rung, input);

    if (priced != null) {
      chosen = { lever: rung, ...priced };
      break;
    }

    skipped.push(`${rung} (${unavailableBecause(rung, input)})`);
  }

  return chosen ?? { lever: 'none', from: input.model, to: input.model, reason: skipped.length === 0 ? `a ${input.cause} retry moves no lever by design (identical bytes, cache-hot)` : `no lever available: ${skipped.join(', ')}` };
}

/**
 * Apply one chosen lever to a request — the ONE place a rung touches the bytes. `'none'` returns the request
 * unchanged (identity, so the transport lane provably resends the same object shape). Every other rung spreads the
 * request, so its `meta` rides through untouched.
 *
 * Applied in the order chosen, so a dispatch whose host raised its attempt cap ACCUMULATES its moves: each attempt
 * still differs from the one before it by exactly one lever, which is the claim the ladder makes.
 *
 * @param request - The request to move.
 * @param lever - The chosen lever.
 * @returns The moved request (the same reference for `'none'`).
 */
export function applyLlmRetryLever(request: LlmRequest, lever: LlmRetryLever): LlmRequest {
  let moved: LlmRequest;

  switch (lever.lever) {
    case 'budget':
      moved = { ...request, maxOutputTokens: Number(lever.to) };
      break;
    case 'model':
      moved = { ...request, model: lever.to };
      break;
    case 'reasoning-off':
      moved = { ...request, reasoning: LLM_RETRY_REASONING_OFF };
      break;
    case 'reasoning-low':
      // The band AND the room it needs, in one application — see the module doc's amendment to the one-lever
      // rule. `headroom` is absent when the budget was already at the ceiling, and then this is byte-identical to
      // what the rung always did.
      moved = { ...request, reasoning: LLM_RETRY_REASONING_LOW, ...(lever.headroom == null ? {} : { maxOutputTokens: lever.headroom }) };
      break;
    case 'structured-off': {
      // Drop the key entirely rather than sending `undefined`: a strategy reads `responseSchemaHint != null`, and
      // the absent key is what makes the re-ask byte-identical to an unconstrained dispatch.
      const { responseSchemaHint: _dropped, ...rest } = request;
      moved = rest;
      break;
    }
    case 'none':
      moved = request;
      break;
  }

  return moved;
}
