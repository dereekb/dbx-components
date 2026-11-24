/**
 * The capability surface: descriptors, schemas, and the two library capabilities (critique-reply, repair-reply-json) as
 * hosts register and override them. Each library capability's own schema, value parser and live-context renderer are
 * internal; specs import them by path.
 */
export * from './llm.capability.descriptor';
export * from './llm.capability.schema';
export {
  critiqueLlmReply,
  DEFAULT_LLM_CRITIQUE_REPLY_INSTRUCTIONS,
  LLM_CRITIQUE_ERROR_DIAG_CODE,
  LLM_CRITIQUE_REPLY_DESCRIPTOR,
  LLM_CRITIQUE_REPLY_JUDGE_SWALLOW_SITE,
  LLM_CRITIQUE_REPLY_MAX_OUTPUT_TOKENS,
  LLM_CRITIQUE_REPLY_TEMPLATE,
  LLM_CRITIQUE_UNUSABLE_DIAG_CODE,
  resolveLlmCritiqueFields,
  makeLlmSemanticCritic
} from './llm.capability.critique.reply';
export type { CritiqueLlmReplyConfig, ResolveLlmCritiqueFieldsConfig, LlmCritiqueOutcome, MakeLlmSemanticCriticConfig, RenderLlmCritiqueContextConfig } from './llm.capability.critique.reply';
export { DEFAULT_LLM_REPAIR_REPLY_JSON_INSTRUCTIONS, LLM_REPAIR_REPLY_JSON_DESCRIPTOR, LLM_REPAIR_REPLY_JSON_MAX_OUTPUT_TOKENS, LLM_REPAIR_REPLY_JSON_TEMPLATE, LLM_REPLY_REPAIR_FAST_FIX_SWALLOW_SITE, makeLlmReplyFastFixer } from './llm.capability.repair.reply.json';
export type { LlmReplyFastFixMetaReader, LlmReplyFastFixRequestBuilder, MakeLlmReplyFastFixerConfig } from './llm.capability.repair.reply.json';
