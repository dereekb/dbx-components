/**
 * The capability descriptor — one capability's reply contract: its key, its reply protocol, its routing and output
 * controls, its arktype wire schema and lever parser, the memoized schema projections the output contract and
 * `response_format` read, a frames policy keyed by slot id, and the host's own `traits`.
 *
 * A descriptor EXTENDS the routing ref (`LlmModelRoutingCapabilityRef`) and the model-precedence ref
 * (`LlmCapabilityModelRef`), so it passes to `compileLlmModelRouting` and `resolveLlmCapabilityModel` as-is. A builder
 * (`defineLlmCapability`) that fills the two memoized projections from the schema joins this module later.
 */

import { type Maybe } from '@dereekb/util';
import { type Type } from 'arktype';
import { type LlmCapabilityModelRef } from '../model/llm.model.precedence';
import { type LlmModelRoutingCapabilityRef } from '../model/llm.model.routing';
import { type LlmCapabilityKey } from '../model/llm.value';
import { type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';

/**
 * Where a capability's frame value comes from when its own request passes none ({@link LlmCapabilityFramePolicy}):
 * `'context'` lets the host contributor that fills the frame resolve the value from its context, and `'off'` closes the
 * frame for the capability even when a value is passed (an honesty instrument: a judge, a decoder, a router).
 */
export type LlmCapabilityFrameSource = 'context' | 'off';

/**
 * A capability's FRAMES policy, keyed by FRAME SLOT id. A frame is a slot a host contributor fills from the request or
 * its context (a tone, a perspective, a style): `'context'` lets it resolve the value from context when the request
 * passes none, `'off'` closes the slot for the capability even when a value is passed, and an omitted slot is
 * value-passed only — the frame lands only when the request carries its value. An explicit request value always wins
 * over the context's.
 */
export type LlmCapabilityFramePolicy = Readonly<Partial<Record<LlmPromptSlotId, LlmCapabilityFrameSource>>>;

/**
 * One capability's reply contract.
 *
 * Inherited from the two refs: `capability` (the key — the SAME string a template's `capability` is keyed by, the
 * template ↔ schema join), `tags` (coarse grouping tags a host routing rule can target a whole family by), `tier`
 * (the preferred model axis: a NAMED tier the dispatcher resolves against the active tier map; unset ⇒ the default
 * tier), `model` (the raw-slug escape hatch; wins over `tier` when both are set), `maxOutputTokens` (the completion
 * cap, resolved ABOVE the tier's own) and `reasoning` (the reasoning controls, resolved ABOVE the tier's and the host
 * floor). A per-call request override wins over all of them.
 *
 * @typeParam T - The parsed (host-mapped) capability output.
 * @typeParam H - The host's own traits ({@link traits}).
 */
export interface LlmCapabilityDescriptor<T = unknown, H extends object = object> extends LlmModelRoutingCapabilityRef, LlmCapabilityModelRef {
  /**
   * The capability's reply protocol. A request's protocol wins over it, and the host default fills in when both are
   * unset (`resolveLlmReplyProtocol`).
   */
  readonly replyProtocol?: LlmReplyProtocol;
  /**
   * Whether this capability can NEVER legitimately decline — a reading / decoding instrument whose worst honest
   * answer is still an answer, so a reply protocol's "if no faithful answer exists, decline" escape hatch is simply
   * wrong for it. The assembly places the must-resolve amendment after a JSON protocol for it. Default OFF.
   */
  readonly mustResolve?: boolean;
  /**
   * Whether this capability's live context carries RAW JSON BY DESIGN — a reading instrument over another
   * capability's reply. Exempts it from the dispatcher's raw-JSON-in-prompt watch, which would otherwise report a
   * false gap on every call. Unset ⇒ watched.
   */
  readonly rawJsonContext?: true;
  /**
   * The capability's frames policy ({@link LlmCapabilityFramePolicy}); omitted ⇒ every frame is value-passed only.
   */
  readonly frames?: LlmCapabilityFramePolicy;
  /**
   * The host's own traits — the flags and keys its contributors and its template resolver read (a voice, a
   * reader-facing flag). The library never reads them.
   */
  readonly traits?: H;
  /**
   * The enforced arktype wire schema a reply lever is validated against.
   */
  readonly responseSchema: Type;
  /**
   * Validate + map an already-unwrapped reply lever; `undefined` ⇒ unusable.
   */
  readonly parseLever: (lever: unknown) => Maybe<T>;
  /**
   * The memoized JSON-Schema projection of {@link responseSchema} (hardened with `additionalProperties: false`,
   * `$schema` dropped) — computed on first call, then cached. What `response_format` carries.
   */
  readonly responseSchemaHint: () => unknown;
  /**
   * The memoized JSON-Schema projection the prompt's output-contract PROSE renders from — the same hardening as
   * {@link responseSchemaHint} over the same schema, but KEEPING each node's `description`. Shape-identical to
   * {@link responseSchemaHint} by construction, so the two never disagree about the STRUCTURE the model is shown vs
   * the structure enforced — they disagree only about whether the schema's authored sentences travel.
   *
   * The split is the point: the sentences ride the PROMPT (the output contract, which lands in the cache prefix)
   * rather than `response_format` (an API parameter outside the cache split, and one a grammar-constrained
   * structured-output backend discards).
   */
  readonly contractSchemaHint: () => unknown;
}

/**
 * The descriptor lookup a dispatcher is given — capability key → its descriptor, or `undefined` for an unregistered
 * capability.
 *
 * @typeParam D - The host's descriptor type.
 */
export type LlmCapabilityDescriptorOf<D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> = (capability: LlmCapabilityKey) => Maybe<D>;
