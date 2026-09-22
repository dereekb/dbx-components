import { type OpenRouterDecisionAnswers, type OpenRouterModelConfig, type OpenRouterPromptDefinition, type OpenRouterPromptKey, type OpenRouterPromptVersionNumber, DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID, openRouterChoiceQuestion, openRouterNoulQuestion, openRouterScoreQuestion } from '@dereekb/openrouter';

/**
 * The demo's DECISION prompt: given a support message, route it and rate it.
 *
 * The counterpart of the resume check, and deliberately the same shape of thing asked the other way.
 * The resume check asks a chat model for prose and reads a verdict back out of it tolerantly, because
 * the model may answer off-shape. This one declares the answer space up front, so there is no reply to
 * parse and nothing to be tolerant about.
 */
export const DEMO_SUPPORT_TRIAGE_PROMPT_KEY: OpenRouterPromptKey = 'demo-support-triage';

/**
 * Human-readable name for {@link DEMO_SUPPORT_TRIAGE_PROMPT_KEY}.
 */
export const DEMO_SUPPORT_TRIAGE_PROMPT_NAME = 'Demo Support Triage';

/**
 * Default System One model the demo asks the triage decision on.
 *
 * Pinned to a VERSIONED slug rather than `jev-latest`, for the reason
 * {@link DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID} states: an alias moves out from under a stored prompt,
 * and a decision's answer is only reproducible against the model that gave it.
 *
 * The server-side seeder overrides it from `OPENROUTER_TEST_DECISION_MODEL_ID`. Any replacement must
 * also be a System One model — a chat slug here is refused at publish time rather than at the wire.
 */
export const DEMO_SUPPORT_TRIAGE_DEFAULT_MODEL_ID = DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID;

/**
 * The state {@link DEMO_SUPPORT_TRIAGE_QUESTIONS} judges.
 *
 * An OBJECT rather than the message text alone, so every question can point at a NAMED part of it with
 * the backticked dot-path convention instead of describing the input again in prose.
 */
export interface DemoSupportTriageState {
  readonly ticket: {
    readonly subject: string;
    readonly body: string;
  };
  readonly [key: string]: unknown;
}

/**
 * The questions {@link DEMO_SUPPORT_TRIAGE_PROMPT_KEY} declares.
 *
 * One snap judgement per question, all three primitives, all against the same state — which is the
 * batching unit AND the cost unit: the state is sent and billed once no matter how many questions ride
 * on it.
 *
 * `team` carries an explicit `other` because a Choice is only ever RELATIVE — its probabilities are
 * normalised over what was supplied, so something always wins even when nothing fits. `spam` rides
 * beside it as the absolute question, and may be high whatever the Choice picked.
 */
export const DEMO_SUPPORT_TRIAGE_QUESTIONS = {
  team: openRouterChoiceQuestion(
    { question: 'Which team should own `ticket`?', inspect: ['ticket.subject', 'ticket.body'] },
    {
      // Contrastive: the SAME keys on every option, so the model compares like with like.
      billing: { what: 'Charges, invoices, refunds, or subscriptions', not_for: 'Anything about signing in', examples: ['I was charged twice'] },
      access: { what: 'Sign-in, passwords, or permissions', not_for: 'Anything about money', examples: ['I cannot log in'] },
      bug: { what: 'Something in the product behaves incorrectly', not_for: 'A request for something the product does not do yet', examples: ['The export button does nothing'] },
      other: { what: 'Anything the other options do not cover' }
    }
  ),
  // Situations, not degrees: "moderately urgent" gives the model nothing to match the state against.
  urgency: openRouterScoreQuestion('How urgent is `ticket`?', [
    { what: 'No deadline is mentioned and nothing is blocked' },
    { what: 'Something is inconvenient but the sender can keep working', signals: ['a workaround is described'] },
    { what: 'The sender names a deadline within the week' },
    { what: 'Money or access is blocked right now', signals: ['cannot pay', 'cannot sign in', 'locked out'] }
  ]),
  // A condition, not a degree — which is what makes this a Noul rather than a Score.
  spam: openRouterNoulQuestion('`ticket` is unsolicited marketing or an automated message rather than a real support request.', {
    true: 'the message advertises something, or was clearly sent by a machine to no one in particular',
    false: 'a person is asking for help with something'
  })
} as const;

/**
 * The answers {@link DEMO_SUPPORT_TRIAGE_QUESTIONS} produces.
 *
 * Derived from the questions rather than declared beside them, so renaming a question is a compile
 * error at every reader instead of an undefined at runtime.
 */
export type DemoSupportTriageAnswers = OpenRouterDecisionAnswers<typeof DEMO_SUPPORT_TRIAGE_QUESTIONS>;

/**
 * Model config for {@link DEMO_SUPPORT_TRIAGE_PROMPT_KEY}.
 *
 * Nothing here but the model. A decision takes `model`, `provider` and `user` and nothing else — no
 * output format, no reasoning budget, no temperature — because it has no free-form output to shape.
 * Anything extra is reported as a dropped-key warning rather than quietly ignored.
 *
 * @param modelId - System One model to ask. Defaults to {@link DEMO_SUPPORT_TRIAGE_DEFAULT_MODEL_ID}.
 * @returns The model config.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function demoSupportTriagePromptConfig(modelId: string = DEMO_SUPPORT_TRIAGE_DEFAULT_MODEL_ID): OpenRouterModelConfig {
  return { model: modelId };
}

/**
 * The version {@link demoSupportTriagePromptDefinition} ships.
 *
 * Bump it whenever the questions or the config change, so an environment already seeded at the previous
 * version picks the new definition up — unless the prompt has been store-locked, in which case the
 * store keeps serving what an operator last wrote.
 */
export const DEMO_SUPPORT_TRIAGE_PROMPT_VERSION: OpenRouterPromptVersionNumber = 1;

/**
 * The demo's support-triage decision, as a code definition.
 *
 * Deliberately NOT `storeLocked`, although a real decision prompt usually wants to be: a decision's
 * answer space is exactly the thing an operator tunes — adding a team to the Choice, splitting an
 * urgency level — and locking on create is what stops a later `version` bump here from publishing over
 * that work. It is omitted only because this registry is the fixture the SEEDER's own specs count
 * against, and a permanently-skipped entry in it would put a lever-specific exception into every one of
 * their assertions. The lever has its own coverage in `openrouter.runtask.emulator.spec.ts`.
 *
 * @param modelId - System One model to ask. Defaults to {@link DEMO_SUPPORT_TRIAGE_DEFAULT_MODEL_ID}.
 * @returns The prompt definition.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function demoSupportTriagePromptDefinition(modelId: string = DEMO_SUPPORT_TRIAGE_DEFAULT_MODEL_ID): OpenRouterPromptDefinition {
  return {
    promptKey: DEMO_SUPPORT_TRIAGE_PROMPT_KEY,
    version: DEMO_SUPPORT_TRIAGE_PROMPT_VERSION,
    name: DEMO_SUPPORT_TRIAGE_PROMPT_NAME,
    description: 'Routes a support message to a team, rates its urgency, and flags spam.',
    config: demoSupportTriagePromptConfig(modelId),
    questions: DEMO_SUPPORT_TRIAGE_QUESTIONS
  };
}
