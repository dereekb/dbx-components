import { type Maybe } from '@dereekb/util';
import { type LlmModelId } from '../model/llm.value';

/**
 * A model id naming a DECISION model — one of TypeSafe's Jev ("System One") models.
 *
 * A decision model does not take messages and does not answer with prose. The caller declares the answer space
 * up front as typed questions and the model returns a position inside it plus a calibrated distribution. More
 * than one gateway serves them: OpenRouter at `POST /systemone`, and ZenMux too.
 */
export type LlmDecisionModelId = LlmModelId;

/**
 * The namespace every decision model id lives under.
 */
export const LLM_DECISION_MODEL_NAMESPACE = 'typesafe';

/**
 * Matches the bare decision model ids (`jev-1.13`, `jev-latest`) the gateways map into the `typesafe/` namespace.
 */
const LLM_BARE_DECISION_MODEL_REGEX = /^jev(-|$)/;

/**
 * Whether a model id names a decision model.
 *
 * This is the ONLY discriminator available, and it is the reason this function exists rather than a lookup:
 * decision models are NOT listed by a gateway's `/models` catalog, so nothing can be learned about one from the
 * catalog. A caller that guessed wrong does not get an error it can read on either arm — a Jev id sent to a
 * completion route fails at the provider, and a chat id sent to the decision route is refused by the route.
 *
 * Both forms are recognised: the namespaced id (`typesafe/jev-1.13`) and the bare one (`jev-1.13`,
 * `jev-latest`), which the gateways map onto the `typesafe/` namespace.
 *
 * @param model - The model id to test.
 * @returns True when the id names a decision model.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isLlmDecisionModelId(model: Maybe<LlmModelId>): boolean {
  const slug = model?.trim().toLowerCase();
  return slug == null || slug === '' ? false : slug.startsWith(`${LLM_DECISION_MODEL_NAMESPACE}/`) || LLM_BARE_DECISION_MODEL_REGEX.test(slug);
}
