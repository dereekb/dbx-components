/**
 * The reply-JSON shape — what a scorer reads off one model reply that should have been a JSON object: a verdict, a
 * score, and the structural faults it found. Types only; the scorer that returns this shape and the deterministic
 * repair tier join this module's folder later. The fast fixer (`LlmReplyFastFixer`) reads it.
 */

/**
 * The scorer's verdict on one reply.
 *
 * - `near-miss` — every fault is one the deterministic tier recovers, the rebuilt text parses into an object, and the
 *   repair is faithful.
 * - `mangled` — object-led, not truncated-looking, but some fault needs judgment (or the rebuilt text failed parse /
 *   fidelity). The fast fix's input.
 * - `truncated-looking` — ends inside a string, or right after `:` / `,` / a bare key / an opener. Never repaired.
 * - `not-json` — no `{`, not object-led, or less than a fifth of the object reads as JSON.
 */
export type LlmReplyJsonVerdict = 'near-miss' | 'mangled' | 'truncated-looking' | 'not-json';

/**
 * One kind of structural fault the scorer's walk found.
 */
export type LlmReplyJsonFaultKind = 'unclosed' | 'trailing-comma' | 'missing-comma' | 'mismatched-closer' | 'stray-closer' | 'control-in-string' | 'inner-quote' | 'trailing-prose' | 'ends-in-string' | 'dangling' | 'unexpected';

/**
 * One recorded fault — its kind and the index in the ORIGINAL text it was found at.
 */
export interface LlmReplyJsonFault {
  /**
   * The fault's kind.
   */
  readonly kind: LlmReplyJsonFaultKind;
  /**
   * The index in the original reply text the fault was found at.
   */
  readonly at: number;
}

/**
 * The scorer's reading of one reply.
 */
export interface LlmReplyJsonShape {
  /**
   * The verdict ({@link LlmReplyJsonVerdict}).
   */
  readonly verdict: LlmReplyJsonVerdict;
  /**
   * The fraction of the object text (first `{` → trimmed end) that is valid JSON before the FIRST structural fault.
   * A reply whose only fault is stopping with containers open scores 1.
   */
  readonly score: number;
  /**
   * Whether the first non-whitespace character (after one optional leading code-fence line) is `{`.
   */
  readonly objectLed: boolean;
  /**
   * The index of the object's opening `{`, `-1` when there is none.
   */
  readonly objectStart: number;
  /**
   * The index of the first structural fault (excluding the end-of-input faults), when there is one.
   */
  readonly faultAt?: number;
  /**
   * The recorded faults, in order (capped by the scorer).
   */
  readonly faults: ReadonlyArray<LlmReplyJsonFault>;
  /**
   * The open-container stack where the walk ended, e.g. `'{'` — `''` when balanced.
   */
  readonly unclosed: string;
  /**
   * The reply length (UTF-16 code units).
   */
  readonly length: number;
}
