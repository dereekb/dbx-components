/**
 * **HOW SURE IS A CHOICE?** — one certainty reader for the answer of ANY Choice question.
 *
 * A Choice is only ever RELATIVE: its probabilities sum to 1, so something always wins, even when the model could
 * not tell two options apart. Its winner is a WHICH only when the answer is SURE: the band (its `confidence`) clears
 * the site's floor AND the margin (winner share − runner-up share) clears the site's margin floor. Every other read
 * names its CONTENDERS — the fewest leading options holding a clear majority — and classifies them:
 *
 * - `nested` — the caller's `coherent` test says the contenders are one thing read at different grains (a group, its
 *   wrapper, its contents), not a choice between things;
 * - `split` — the contenders reach the mass: a real ambiguity among a few;
 * - `diffuse` — the cap came first: the lane could not narrow the pool at all;
 * - `unread` — no distribution and no finite confidence: nothing to read, so the caller keeps its pre-certainty rule.
 *
 * **No default floors** (thresholds are per question and per stakes): every site names its own constants. An absent
 * `confidence` reads as the winner's share — {@link toLlmDecisionConfidenceBand} reads it `low`, which would refuse
 * every confidence-less reply a lax gateway returns.
 */

import type { Maybe, Count, PercentDecimal } from '@dereekb/util';
import { toLlmDecisionConfidenceBand, llmDecisionChoiceRanking, type LlmDecisionChoiceAnswer, type LlmDecisionConfidenceBand } from './llm.decision.question';

/**
 * What a Choice's answer reads as — see the module doc.
 */
export type LlmChoiceCertaintyKind = 'sure' | 'nested' | 'split' | 'diffuse' | 'unread';

/**
 * A site's floors. Each is a named, site-local constant with a stated rationale; none is derived from another.
 */
export interface LlmChoiceCertaintyFloors {
  /**
   * The confidence a sure read must reach.
   */
  readonly sureConfidence: PercentDecimal;
  /**
   * The winner-minus-runner-up margin a sure read must reach (when a distribution is present).
   */
  readonly sureMargin: PercentDecimal;
  /**
   * The summed share the contenders of an unsure read stop at.
   */
  readonly contenderMass: PercentDecimal;
  /**
   * The most contenders an unsure read names.
   */
  readonly contendersMax: Count;
}

/**
 * One contender — an option and its share, most probable first.
 */
export interface LlmChoiceContender<O extends string = string> {
  readonly option: O;
  readonly probability: PercentDecimal;
}

/**
 * What {@link readLlmChoiceCertainty} read.
 */
export interface LlmChoiceCertainty<O extends string = string> {
  readonly certainty: LlmChoiceCertaintyKind;
  /**
   * The band of {@link confidence}.
   */
  readonly band: LlmDecisionConfidenceBand;
  /**
   * The Choice's own confidence; the winner's share when absent. Absent only on an `unread` answer.
   */
  readonly confidence?: PercentDecimal;
  /**
   * The winner's share minus the runner-up's. Absent when the answer carries no distribution.
   */
  readonly margin?: PercentDecimal;
  /**
   * The leading options, most probable first — just the winner on a sure read.
   */
  readonly contenders: ReadonlyArray<LlmChoiceContender<O>>;
  /**
   * The contenders' summed share. Absent when the answer carries no distribution.
   */
  readonly mass?: PercentDecimal;
}

/**
 * The reader's configuration.
 */
export interface LlmChoiceCertaintyConfig<O extends string = string> {
  readonly floors: LlmChoiceCertaintyFloors;
  /**
   * Whether an unsure read's contenders are ONE thing at different grains (⇒ `nested`). Absent ⇒ never nested.
   */
  readonly coherent?: Maybe<(contenders: ReadonlyArray<O>) => boolean>;
}

/**
 * Classifies an UNSURE read (rule 6 of {@link readLlmChoiceCertainty}): `nested` when the caller says the contenders
 * cohere, else `split` when they reached the mass, else `diffuse`.
 *
 * @param input - The contenders, their summed share, the site floors and the coherence test.
 * @param input.contenders - The leading options, most probable first.
 * @param input.mass - The contenders' summed share.
 * @param input.floors - The site's floors.
 * @param input.coherent - The caller's coherence test, if any.
 * @returns The unsure class.
 */
function llmUnsureChoiceCertaintyKind<O extends string>(input: { readonly contenders: ReadonlyArray<LlmChoiceContender<O>>; readonly mass: PercentDecimal; readonly floors: LlmChoiceCertaintyFloors; readonly coherent?: LlmChoiceCertaintyConfig<O>['coherent'] }): LlmChoiceCertaintyKind {
  const { contenders, mass, floors, coherent } = input;
  let certainty: LlmChoiceCertaintyKind;

  if (contenders.length >= 2 && coherent?.(contenders.map((contender) => contender.option)) === true) {
    certainty = 'nested';
  } else if (mass >= floors.contenderMass) {
    certainty = 'split';
  } else {
    certainty = 'diffuse';
  }

  return certainty;
}

/**
 * **READ A CHOICE'S CERTAINTY** — the rules, in order:.
 *
 * 1. the ranking is {@link llmDecisionChoiceRanking}'s (most probable first, ties in declaration order); the winner is its head, else
 *    `answer.choice`;
 * 2. the confidence is `answer.confidence` when finite, else the winner's share; with neither ⇒ `unread`;
 * 3. the margin is the head's share minus the runner-up's (absent with no distribution: the band alone decides);
 * 4. `sure` ⇔ confidence ≥ `sureConfidence` AND (no margin OR margin ≥ `sureMargin`);
 * 5. the contenders are the leading options until their share reaches `contenderMass`, at least 2 (when the ranking
 *    has two), at most `contendersMax`; a sure read reports the winner alone;
 * 6. not sure ⇒ `nested` when `coherent(contenders)`, else `split` when the mass reached `contenderMass`, else
 *    `diffuse`.
 *
 * Pure: the same answer always reads the same.
 *
 * @param answer - The Choice's answer.
 * @param config - The site's floors and its coherence test.
 * @returns The read.
 */
export function readLlmChoiceCertainty<O extends string>(answer: LlmDecisionChoiceAnswer<O>, config: LlmChoiceCertaintyConfig<O>): LlmChoiceCertainty<O> {
  const { floors } = config;
  const ranking = llmDecisionChoiceRanking(answer);
  const head = ranking[0];
  const winner: LlmChoiceContender<O> | undefined = head ?? (Number.isFinite(answer.confidence) ? { option: answer.choice, probability: answer.confidence as number } : undefined);
  const confidence = Number.isFinite(answer.confidence) ? (answer.confidence as number) : head?.probability;
  let read: LlmChoiceCertainty<O>;

  if (confidence == null || winner == null) {
    read = { certainty: 'unread', band: toLlmDecisionConfidenceBand(undefined), contenders: [{ option: answer.choice, probability: 0 }] };
  } else {
    const band = toLlmDecisionConfidenceBand(confidence);
    const margin = head == null ? undefined : head.probability - (ranking[1]?.probability ?? 0);
    const sure = confidence >= floors.sureConfidence && (margin == null || margin >= floors.sureMargin);
    const measured = { band, confidence, ...(margin == null ? {} : { margin }) };

    if (sure) {
      read = { certainty: 'sure', ...measured, contenders: [winner], ...(head == null ? {} : { mass: head.probability }) };
    } else if (head == null) {
      // No distribution: the band alone says unsure, and nothing narrows the pool.
      read = { certainty: 'diffuse', ...measured, contenders: [winner] };
    } else {
      const contenders: LlmChoiceContender<O>[] = [];
      let mass = 0;

      for (const row of ranking) {
        if (contenders.length >= floors.contendersMax || (contenders.length >= 2 && mass >= floors.contenderMass)) {
          break;
        }

        contenders.push({ option: row.option, probability: row.probability });
        mass += row.probability;
      }

      read = { certainty: llmUnsureChoiceCertaintyKind({ contenders, mass, floors, coherent: config.coherent }), ...measured, contenders, mass };
    }
  }

  return read;
}
