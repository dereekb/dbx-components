/**
 * The `tape` {@link LlmStrategy} — a PURE, credential-free backend that serves RECORDED completions instead of calling a
 * provider. It backs a **tape-replay lane**: re-drive a scenario with a prior run's own completions substituted for the
 * model, so a post-parse fix can be CONFIRMED against real artifacts for zero billed calls.
 *
 * Why this exists. Generated prose resamples on every run, so a billed re-run cannot summon the exact reply a fix was
 * built for. A single billed run can FALSIFY an expectation; it can never CONFIRM one. Replaying the tape can: the
 * recorded completions ARE the only non-determinism in a run, so feeding them back makes the whole run deterministic and
 * every delta attributable to the code under test and nothing else.
 *
 * **No fs, no net.** The tape is READ by the host (its tape reader parses the recorded call logs) and handed in as
 * {@link LlmTapeTurn}s. This module only matches and serves.
 *
 * **The match key is the recorded prompt.** A call record persists its prompt (or the segments that join back into it),
 * and that string is `LlmRequest.prompt` by construction, so the string a tape carries and the string
 * {@link makeLlmTapeStrategy} hashes are the same string and hash matches are preserved. A recording whose prompt bytes
 * no longer match today's assembly degrades to `order` matches rather than `hash` ones — the reason order matching
 * exists at all. `LlmRequest.thread` is deliberately NOT part of the key: a chained follow-up's replayed history is not
 * recorded, so hashing it would make every follow-up turn unmatchable. Two follow-ups with identical `capability` +
 * prompt are therefore indistinguishable by hash — harmless, because matching consumes the FIRST unconsumed turn either
 * way.
 *
 * @see LlmStrategy (the contract this implements).
 */

import { filterMaybeValues, type Maybe, sha256HexPrefix, type IndexNumber, type HexString, toMaybeString } from '@dereekb/util';
import { isDecisionLlmCallRow, type LlmCapabilityKey, type LlmCompletion, type LlmModelId, type LlmRequest, type LlmStrategy, type LlmStrategyHealth, type LlmStrategyId, type LlmUsage, readLlmCallPrompt } from '@dereekb/llm';

/**
 * The registry id (and kind) of the tape strategy. A host pins it programmatically as the default strategy of a replay
 * run; a keyless run that routed here by accident would find no registered strategy and fail at dispatch.
 */
export const LLM_TAPE_STRATEGY_ID: LlmStrategyId = 'tape';

/**
 * The hash length (hex chars) of the default {@link makeLlmTapeStrategy} prompt digest — long enough that a collision
 * within one run's handful of calls is not a thing that happens, short enough to read in a report.
 */
export const LLM_TAPE_PROMPT_SHA_LENGTH = 12;

/**
 * One RECORDED call the tape can serve — a `(capability, prompt)` the run sent and the `text` the model answered, plus
 * the telemetry the replayed {@link LlmCompletion} echoes so the report's shape survives.
 */
export interface LlmTapeTurn {
  /**
   * The capability this call resolved. Part of the match key: a turn is only ever served to a request of the SAME
   * capability.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The digest of the recorded prompt ({@link hashLlmTapePrompt}) — the hash half of the match key.
   */
  readonly promptSha: HexString;
  /**
   * The recorded completion text, served back verbatim.
   */
  readonly text: string;
  /**
   * The model that served the recording, echoed onto the replayed result.
   */
  readonly model?: LlmModelId;
  /**
   * The recorded token usage, echoed with `cost` FORCED to `0` (see {@link makeLlmTapeStrategy}).
   */
  readonly usage?: LlmUsage;
  /**
   * The recorded `finish_reason`, echoed for attribution.
   */
  readonly finishReason?: string;
}

/**
 * How a served turn was matched: by prompt HASH (a byte-identical replay) or by ORDER (the prompt drifted, so the next
 * unconsumed turn of the same capability was served instead).
 */
export type LlmTapeMatchKind = 'hash' | 'order';

/**
 * One served turn, recorded so a replay reporter can render the fidelity table and the prompt diffs WITHOUT
 * re-dispatching anything.
 */
export interface LlmTapeMatch {
  /**
   * The index of the consumed turn in the tape.
   */
  readonly turnIndex: IndexNumber;
  /**
   * How the turn was matched.
   */
  readonly kind: LlmTapeMatchKind;
  /**
   * The capability served.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The tape turn's recorded prompt digest.
   */
  readonly tapePromptSha: HexString;
  /**
   * The digest of the prompt the REPLAY actually assembled. Equal to {@link tapePromptSha} on a `hash` match.
   */
  readonly requestPromptSha: HexString;
  /**
   * The prompt the replay assembled, kept verbatim so a reporter can diff it against the tape's without a second
   * dispatch. (The tape's own prompt text lives in the host's tape reader, not here.)
   */
  readonly requestPrompt: string;
}

/**
 * Why a tape could not serve a request — the two loud failures. `tape-exhausted`: nothing unconsumed remains (the replay
 * made MORE calls than the recording). `capability-drift`: unconsumed turns remain but none of this capability, so the
 * call SEQUENCE changed since the tape was recorded and serving any text would be fiction.
 *
 * Either one TRUNCATES the replay at that call rather than voiding it: the calls already served came from the recording
 * verbatim, so a reading over that consumed window is sound. What a refusal voids is any reading of the scenario's
 * outcome, plus everything past the truncation, which never ran at all.
 */
export type LlmTapeFailureKind = 'tape-exhausted' | 'capability-drift';

/**
 * The error {@link LlmTapeStrategy.complete} throws when the tape cannot honestly serve a request. Carries the
 * {@link kind} so a harness can render the right verdict instead of parsing a message.
 */
export class LlmTapeStrategyError extends Error {
  /**
   * Which refusal this is.
   */
  readonly kind: LlmTapeFailureKind;

  /**
   * @param kind - Which refusal this is.
   * @param message - The refusal, naming the call it truncated at.
   */
  constructor(kind: LlmTapeFailureKind, message: string) {
    super(message);
    this.name = 'LlmTapeStrategyError';
    this.kind = kind;
  }
}

/**
 * Whether a thrown value is an {@link LlmTapeStrategyError} — a tape refusal that TRUNCATED a replay rather than a defect
 * in the code under test. Checks the `name` + `kind` shape rather than `instanceof`, so it still answers correctly across
 * a module-registry boundary (a harness that spawns its runs as children may load a duplicated module instance, which
 * would defeat a prototype check).
 *
 * @param value - The thrown value.
 * @returns `true` when the value is a tape refusal.
 */
export function isLlmTapeStrategyError(value: unknown): value is LlmTapeStrategyError {
  return value instanceof Error && value.name === 'LlmTapeStrategyError' && typeof (value as LlmTapeStrategyError).kind === 'string';
}

/**
 * One request the tape refused to serve — recorded ALONGSIDE the throw, because a host that swallows dispatch failures
 * fail-open would otherwise hide it: without this record a `capability-drift` would silently degrade the replay to
 * fallback text and the report would call the turn merely "unconsumed".
 */
export interface LlmTapeFailure {
  /**
   * Which refusal this was.
   */
  readonly kind: LlmTapeFailureKind;
  /**
   * The capability that could not be served.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The digest of the refused request's prompt.
   */
  readonly requestPromptSha: HexString;
}

/**
 * The {@link LlmStrategy} a replay registers, plus the read-backs a reporter needs once the run is over.
 */
export interface LlmTapeStrategy extends LlmStrategy {
  /**
   * Every turn served, in the order it was served.
   *
   * @returns The served matches.
   */
  matches(): ReadonlyArray<LlmTapeMatch>;
  /**
   * The indices of the tape turns NOBODY consumed — a replay that made FEWER calls than the recording.
   *
   * @returns The unconsumed turn indices, ascending.
   */
  unconsumed(): ReadonlyArray<IndexNumber>;
  /**
   * Every request the tape refused, in order — see {@link LlmTapeFailure}.
   *
   * @returns The recorded refusals.
   */
  failures(): ReadonlyArray<LlmTapeFailure>;
}

/**
 * Config for {@link makeLlmTapeStrategy}.
 */
export interface LlmTapeStrategyConfig {
  /**
   * The INSTANCE name this strategy registers under ({@link LlmStrategy.id}); defaults to {@link LLM_TAPE_STRATEGY_ID}.
   * A replay harness comparing two tapes in one process needs two instances; the `kind` stays `'tape'` either way.
   */
  readonly id?: Maybe<LlmStrategyId>;
  /**
   * The recorded turns, in recording order.
   */
  readonly turns: ReadonlyArray<LlmTapeTurn>;
  /**
   * The prompt digest. Defaults to {@link hashLlmTapePrompt}; injected by specs so a fixture can pin readable digests.
   * MUST be the same function the tape's {@link LlmTapeTurn.promptSha} values were computed with.
   */
  readonly hash?: Maybe<(text: string) => HexString>;
}

/**
 * The default prompt digest — the first {@link LLM_TAPE_PROMPT_SHA_LENGTH} hex chars of the sha256 of the prompt's UTF-8
 * bytes. Used by BOTH the host's tape reader (over the recorded prompt) and this strategy (over `LlmRequest.prompt`),
 * which is what makes a byte-identical replay match by hash. Pure (no `node:crypto`), and byte-equal to a
 * `createHash('sha256')` digest, so a tape recorded either way matches.
 *
 * @param text - The prompt text.
 * @returns The digest.
 */
export function hashLlmTapePrompt(text: string): HexString {
  return sha256HexPrefix(text, LLM_TAPE_PROMPT_SHA_LENGTH);
}

/**
 * Build an {@link LlmTapeStrategy} over a set of recorded turns.
 *
 * Matching, per `complete(request)`:
 *
 * 1. An UNCONSUMED turn of the same {@link LlmTapeTurn.capability} whose {@link LlmTapeTurn.promptSha} equals the request
 *    prompt's digest ⇒ a `hash` match. Hash-FIRST (not cursor-first) so the strategy is immune to any dispatch
 *    reordering, and so a byte-identical replay consumes the tape in exact order with zero divergence.
 * 2. Else the NEXT unconsumed turn of the same capability ⇒ an `order` match (a prompt drift). The tape text is served
 *    anyway so the run COMPLETES and the divergence is reportable rather than fatal.
 * 3. Else throw an {@link LlmTapeStrategyError} — `tape-exhausted` or `capability-drift` — which TRUNCATES the replay at
 *    this call. Everything served before it stays readable; nothing past it runs.
 *
 * The served completion forces `usage.cost` to `0` while KEEPING the recorded token counts: zeroing the counts would trip
 * a zero-call detector for the wrong reason, and keeping them makes prompt-size drift visible in a report. A replay must
 * never be read as a budget sample.
 *
 * @param config - The recorded turns and an optional digest override.
 * @returns The tape strategy.
 *
 * @example
 * ```ts
 * const tape = makeLlmTapeStrategy({ turns: [{ capability: 'summarize', promptSha: hashLlmTapePrompt(prompt), text: 'recorded reply' }] });
 * const completion = await tape.complete({ capability: 'summarize', prompt }); // 'recorded reply', billed nothing
 * ```
 */
export function makeLlmTapeStrategy(config: LlmTapeStrategyConfig): LlmTapeStrategy {
  const id = config.id ?? LLM_TAPE_STRATEGY_ID;
  const turns = [...config.turns];
  const hash = config.hash ?? hashLlmTapePrompt;
  const consumed = new Set<number>();
  const matches: LlmTapeMatch[] = [];
  const failures: LlmTapeFailure[] = [];

  const findIndex = (predicate: (turn: LlmTapeTurn) => boolean): Maybe<number> => {
    let found: Maybe<number>;

    for (const [index, turn] of turns.entries()) {
      if (!consumed.has(index) && predicate(turn)) {
        found = index;
        break;
      }
    }

    return found;
  };

  return {
    id,
    kind: LLM_TAPE_STRATEGY_ID,
    describe: `tape replay: serves ${turns.length} recorded completion(s); makes no network call and bills nothing`,
    // The recorded run's caching behaviour is not reproducible and not being measured; a replay declares none.
    caching: 'none',
    async complete(request: LlmRequest): Promise<LlmCompletion> {
      const requestPromptSha = hash(request.prompt);
      const byHash = findIndex((turn) => turn.capability === request.capability && turn.promptSha === requestPromptSha);
      const turnIndex = byHash ?? findIndex((turn) => turn.capability === request.capability);

      if (turnIndex == null) {
        const remaining = turns.length - consumed.size;
        const call = matches.length + 1;
        const served = matches.length;
        // RECORD before throwing: a host that swallows dispatch failures fail-open would otherwise hide the cause.
        failures.push({ kind: remaining === 0 ? 'tape-exhausted' : 'capability-drift', capability: request.capability, requestPromptSha });
        // A tape that still holds turns, none of this capability, means the call SEQUENCE changed — a different scenario
        // than the one recorded. Serving text into it would be fiction, so both cases fail loud.
        throw remaining === 0
          ? new LlmTapeStrategyError(
              'tape-exhausted',
              `tape replay exhausted at call ${call}: the replay made more LLM calls than the ${turns.length}-turn tape recorded (next unmatched: '${request.capability}'). The replay is TRUNCATED here: calls 1..${served} were served from the recording and stay readable; nothing past this call ran.`
            )
          : new LlmTapeStrategyError(
              'capability-drift',
              `tape replay hit a capability drift at call ${call}: '${request.capability}' was requested but none of the ${remaining} unconsumed turn(s) is that capability. The call SEQUENCE changed since the tape was recorded. The replay is TRUNCATED here: calls 1..${served} were served from the recording and stay readable; nothing past this call ran.`
            );
      }

      const turn = turns[turnIndex] as LlmTapeTurn;
      consumed.add(turnIndex);
      matches.push({ turnIndex, kind: byHash == null ? 'order' : 'hash', capability: turn.capability, tapePromptSha: turn.promptSha, requestPromptSha, requestPrompt: request.prompt });

      return {
        text: turn.text,
        strategyId: id,
        strategyKind: LLM_TAPE_STRATEGY_ID,
        capability: request.capability,
        ...(request.meta == null ? {} : { meta: request.meta }),
        ...(turn.model == null ? {} : { model: turn.model }),
        // Tokens KEPT (so the report keeps its shape and prompt-size drift stays visible); cost FORCED to zero — a replay
        // spends nothing and must never read as a budget sample.
        ...(turn.usage == null ? {} : { usage: { ...turn.usage, cost: 0 } }),
        latencyMs: 0,
        ...(turn.finishReason == null ? {} : { finishReason: turn.finishReason }),
        schemaEnforced: false
      };
    },
    // Ready UNCONDITIONALLY and with no credential: that is the whole point of the lane. A tape with no turns is still
    // ready — it fails at the first `complete` with a precise `tape-exhausted`, a better message than a startup verdict.
    async healthCheck(): Promise<LlmStrategyHealth> {
      return { ready: true, issues: [] };
    },
    matches(): ReadonlyArray<LlmTapeMatch> {
      return matches;
    },
    unconsumed(): ReadonlyArray<IndexNumber> {
      return turns.map((_, index) => index).filter((index) => !consumed.has(index));
    },
    failures(): ReadonlyArray<LlmTapeFailure> {
      return failures;
    }
  };
}

/**
 * Config for {@link readLlmTapeTurn}.
 */
export interface ReadLlmTapeTurnConfig {
  /**
   * The decision transports' strategy kinds (`readLlmDecisionStrategyKinds(adapters)`), so a decision row without a
   * `decision` id is still skipped. See `isDecisionLlmCallRow`.
   */
  readonly decisionStrategyKinds?: Maybe<ReadonlySet<LlmStrategyId>>;
  /**
   * The prompt digest. MUST be the same function the tape strategy matches with ({@link LlmTapeStrategyConfig.hash});
   * defaults to {@link hashLlmTapePrompt}.
   */
  readonly hash?: Maybe<(text: string) => HexString>;
}

/**
 * Turn one PERSISTED `llm_call` payload into a {@link LlmTapeTurn} — the per-row half of a host's tape reader.
 *
 * A row becomes a turn only when it carries a prompt (`readLlmCallPrompt`, so a segments-only row answers too), a
 * string `text` and a `capability`, and is not a decision-lane row (`isDecisionLlmCallRow`): a decision row carries a
 * prompt and a JSON `text` too, and a text tape would otherwise serve its answer set to whichever completion hashed
 * next.
 *
 * It reads a persisted payload (`LlmCallLogPayload`): an in-memory `LlmCallRecord` has no top-level `text`, so project
 * it with `toLlmCallLogPayload(record, { keepIo: true })` first. A host keeps its own extras by spreading, e.g.
 * `{ ...turn, prompt: readLlmCallPrompt(payload) }`.
 *
 * @param payload - The `llm_call` payload (or anything).
 * @param config - The decision kinds and the prompt digest.
 * @returns The turn, or `undefined` for a row with no captured prompt or reply, a decision row, or a non-object.
 *
 * @example
 * ```ts
 * const turns = payloads.map((payload) => readLlmTapeTurn(payload, { decisionStrategyKinds })).filter((turn) => turn != null);
 * const tape = makeLlmTapeStrategy({ turns });
 * ```
 */
export function readLlmTapeTurn(payload: unknown, config?: Maybe<ReadLlmTapeTurnConfig>): Maybe<LlmTapeTurn> {
  let turn: Maybe<LlmTapeTurn>;

  if (payload != null && typeof payload === 'object') {
    const record = payload as Readonly<Record<string, unknown>>;
    const prompt = readLlmCallPrompt(payload);
    const text = record['text'];
    const capability = toMaybeString(record['capability']);

    if (prompt != null && typeof text === 'string' && capability != null && !isDecisionLlmCallRow(payload, config?.decisionStrategyKinds)) {
      const model = toMaybeString(record['model']);
      const finishReason = toMaybeString(record['finishReason']);
      const hash = config?.hash ?? hashLlmTapePrompt;
      turn = filterMaybeValues({ capability, promptSha: hash(prompt), text, model, usage: record['usage'] as Maybe<LlmUsage>, finishReason });
    }
  }

  return turn;
}
