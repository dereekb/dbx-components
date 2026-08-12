import { type Maybe, mergeObjects } from '@dereekb/util';
import { type OpenRouterModelId } from './openrouter.type';

/**
 * Reasoning effort accepted by OpenRouter's `reasoning.effort`.
 */
export type OpenRouterReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * Reasoning mode accepted by OpenRouter's `reasoning.mode`.
 */
export type OpenRouterReasoningMode = 'standard' | 'pro';

/**
 * Reasoning summary verbosity accepted by OpenRouter's `reasoning.summary`.
 */
export type OpenRouterReasoningSummary = 'auto' | 'concise' | 'detailed';

/**
 * Output verbosity accepted by OpenRouter's `text.verbosity`.
 *
 * This is the OpenAI-dashboard "Verbosity" control.
 */
export type OpenRouterVerbosity = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * Reasoning configuration. Replaces the OpenAI dashboard's reasoning mode / effort / summary
 * controls.
 */
export interface OpenRouterReasoningConfig {
  readonly enabled?: Maybe<boolean>;
  readonly effort?: Maybe<OpenRouterReasoningEffort>;
  readonly mode?: Maybe<OpenRouterReasoningMode>;
  readonly summary?: Maybe<OpenRouterReasoningSummary>;
  /**
   * Named `max_tokens` on the wire — the SDK does not camelCase this one.
   */
  readonly max_tokens?: Maybe<number>;
}

/**
 * A JSON-schema output format, replacing the OpenAI dashboard's structured-output setting.
 */
export interface OpenRouterJsonSchemaFormat {
  readonly type: 'json_schema';
  readonly name: string;
  readonly strict?: Maybe<boolean>;
  readonly schema: Record<string, unknown>;
}

/**
 * Output format, replacing the OpenAI dashboard's "Text format" setting.
 */
export type OpenRouterTextFormat = { readonly type: 'text' } | { readonly type: 'json_object' } | OpenRouterJsonSchemaFormat;

/**
 * Text/output configuration — OpenRouter's `text` object.
 */
export interface OpenRouterTextConfig {
  readonly format?: Maybe<OpenRouterTextFormat>;
  readonly verbosity?: Maybe<OpenRouterVerbosity>;
}

/**
 * Provider routing configuration — OpenRouter's `provider` object.
 *
 * Pinning matters more than it looks: without `requireParameters`, OpenRouter's docs state
 * "providers will receive only the parameters they support, and ignore the rest", so an unpinned
 * call can silently drop a parameter and return a confidently wrong answer with no error.
 */
export interface OpenRouterProviderConfig {
  readonly only?: Maybe<string[]>;
  readonly order?: Maybe<string[]>;
  readonly ignore?: Maybe<string[]>;
  readonly allowFallbacks?: Maybe<boolean>;
  readonly requireParameters?: Maybe<boolean>;
  readonly dataCollection?: Maybe<'allow' | 'deny'>;
  readonly sort?: Maybe<string | Record<string, unknown>>;
  readonly quantizations?: Maybe<string[]>;
  readonly zdr?: Maybe<boolean>;
  readonly maxPrice?: Maybe<Record<string, string>>;
}

/**
 * PDF parsing engine for the `file-parser` plugin.
 *
 * - `native` — the model provider parses the PDF itself (OpenAI, on our BYOK key), billed as input
 *   tokens, with no image cap.
 * - `mistral-ocr` — Mistral's OCR service, billed by OpenRouter per page, capped at 8 images per PDF
 *   with the surplus silently dropped.
 * - `cloudflare-ai` — Cloudflare Workers AI, free, PDF to markdown.
 */
export type OpenRouterPdfParserEngine = 'native' | 'mistral-ocr' | 'cloudflare-ai';

/**
 * The `file-parser` plugin. Replaces OpenAI's code-interpreter/file-upload path for PDF input.
 */
export interface OpenRouterFileParserPluginConfig {
  readonly id: 'file-parser';
  readonly enabled?: Maybe<boolean>;
  readonly pdf?: Maybe<{ readonly engine?: Maybe<OpenRouterPdfParserEngine> }>;
}

/**
 * Any OpenRouter plugin entry. Only `file-parser` is modeled precisely; the rest are passed through.
 */
export type OpenRouterPluginConfig = OpenRouterFileParserPluginConfig | ({ readonly id: string } & Record<string, unknown>);

/**
 * A hosted (server-executed) tool entry, e.g. a `file_search` or `mcp` tool.
 */
export type OpenRouterHostedToolConfig = { readonly type: string } & Record<string, unknown>;

/**
 * The hosted `file_search` tool.
 *
 * Field names are CAMELCASE, matching the SDK's request surface rather than the wire. That is not a
 * style choice: `@openrouter/sdk` validates the request body against a closed schema that names this
 * field `vectorStoreIds` and remaps it to `vector_store_ids` on the way out — so a config authored with
 * the wire name is dropped during serialization, and the call goes out with a `file_search` tool that
 * searches nothing. OpenRouter answers it anyway, confidently and ungrounded, with no error.
 */
export interface OpenRouterFileSearchToolConfig {
  readonly type: 'file_search';
  /**
   * The OpenAI vector stores to search. A `vs_…` id resolves only for the org that owns it, so this
   * works only where OpenRouter authenticates upstream with a BYOK key from that org.
   *
   * The passthrough itself is verified: OpenRouter forwards the tool to OpenAI, which resolves the id.
   * See `openrouter.filesearch.spike.spec.ts`.
   */
  readonly vectorStoreIds: string[];
  readonly maxNumResults?: Maybe<number>;
  readonly rankingOptions?: Maybe<{ readonly ranker?: Maybe<string>; readonly scoreThreshold?: Maybe<number> }>;
  readonly filters?: Maybe<Record<string, unknown>>;
  /**
   * Passthrough for anything the hosted tool grows that this interface does not yet name.
   */
  readonly [key: string]: unknown;
}

/**
 * Builds a hosted `file_search` tool entry with the field names the SDK actually forwards.
 *
 * @param vectorStoreIds - The `vs_…` ids to search.
 * @param maxNumResults - Optional cap on returned chunks.
 * @returns The hosted tool entry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterFileSearchTool(vectorStoreIds: string[], maxNumResults?: Maybe<number>): OpenRouterFileSearchToolConfig {
  return { type: 'file_search', vectorStoreIds, ...(maxNumResults == null ? undefined : { maxNumResults }) };
}

/**
 * The default PDF parser engine this package pins.
 *
 * Pinned because the alternative is silent: with no engine named, OpenRouter downgrades any model it
 * believes lacks native file support to `mistral-ocr`, inheriting its 8-image cap and per-page billing with
 * no error — which on a multi-page document quietly truncates content.
 */
export const DEFAULT_OPENROUTER_PDF_PARSER_ENGINE: OpenRouterPdfParserEngine = 'native';

/**
 * The `file-parser` plugin entry with the PDF engine pinned.
 *
 * @param engine - Engine to pin. Defaults to {@link DEFAULT_OPENROUTER_PDF_PARSER_ENGINE}.
 * @returns The plugin config entry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterFileParserPlugin(engine: OpenRouterPdfParserEngine = DEFAULT_OPENROUTER_PDF_PARSER_ENGINE): OpenRouterFileParserPluginConfig {
  return { id: 'file-parser', pdf: { engine } };
}

/**
 * A provider config that pins routing to a single provider with fallbacks off and parameter support
 * required — the configuration that makes a BYOK request actually reach the intended upstream with
 * every parameter intact.
 *
 * @param provider - The provider slug to pin to (e.g. `openai`).
 * @returns The provider routing config.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterProviderPinnedTo(provider: string): OpenRouterProviderConfig {
  return { only: [provider], allowFallbacks: false, requireParameters: true };
}

/**
 * Model configuration for an OpenRouter prompt version, or a per-run override of one.
 *
 * Field names follow the `@openrouter/sdk` request surface (camelCase), because a merged config is
 * spread directly into `callModel`. The SDK converts them to the wire's snake_case names.
 *
 * This interface exists for autocomplete and optional call-time validation ONLY — the persisted
 * value is passthrough JSON, deliberately not a strict Firestore converter. OpenRouter's parameter
 * surface moves fast (the previously pinned `0.12.79` SDK was already missing several params present
 * in `1.2.x`), and a strict converter would silently drop unknown fields on every release. Strict
 * types in code, loose storage: hence the index signature.
 *
 * Concepts with no OpenRouter equivalent are deliberately absent. OpenAI's "Store logs" is one —
 * OpenRouter is stateless and `store` is type-pinned to `false`.
 */
export interface OpenRouterModelConfig {
  /**
   * Primary model to route to.
   */
  readonly model?: Maybe<OpenRouterModelId>;
  /**
   * Fallback chain, tried in order when the primary model is unavailable.
   */
  readonly models?: Maybe<OpenRouterModelId[]>;
  /**
   * Output format + verbosity.
   */
  readonly text?: Maybe<OpenRouterTextConfig>;
  /**
   * Reasoning mode / effort / summary.
   */
  readonly reasoning?: Maybe<OpenRouterReasoningConfig>;
  /**
   * Provider routing — where BYOK pinning goes.
   */
  readonly provider?: Maybe<OpenRouterProviderConfig>;
  /**
   * Plugins: `file-parser`, `web`, `context-compression`.
   */
  readonly plugins?: Maybe<OpenRouterPluginConfig[]>;
  /**
   * Hosted (server-executed) tools, e.g. `file_search`, `mcp`, `web_search`.
   *
   * A config carrying any of these is dispatched off the `callModel` path — `callModel` converts every
   * `tools` entry as a client function tool — and goes either straight to `/responses` or through a
   * `ModelResult` that appends them after client-tool conversion. See `openRouterHostedTools`.
   */
  readonly tools?: Maybe<OpenRouterHostedToolConfig[]>;
  readonly toolChoice?: Maybe<unknown>;
  readonly parallelToolCalls?: Maybe<boolean>;
  readonly maxToolCalls?: Maybe<number>;
  /**
   * Extra response parts to include, e.g. `file_search_call.results`.
   */
  readonly include?: Maybe<string[]>;
  readonly maxOutputTokens?: Maybe<number>;
  readonly temperature?: Maybe<number>;
  readonly topP?: Maybe<number>;
  readonly topK?: Maybe<number>;
  readonly seed?: Maybe<number>;
  readonly stop?: Maybe<string | string[]>;
  readonly frequencyPenalty?: Maybe<number>;
  readonly presencePenalty?: Maybe<number>;
  readonly promptCacheKey?: Maybe<string>;
  readonly truncation?: Maybe<string>;
  readonly user?: Maybe<string>;
  /**
   * Ceiling on tool-call steps, passed to the Agent SDK's `stopWhen`.
   *
   * NOTE: this bounds the number of tool-call rounds, NOT the duration of one inference. A single
   * inference is atomic and cannot be interrupted — use {@link requestTimeoutMs} for that.
   */
  readonly maxSteps?: Maybe<number>;
  /**
   * Per-request wall-clock timeout in milliseconds.
   *
   * The one bound on a single inference. Required in practice for the run-task sweeper: without it,
   * one unusually slow call can overrun the sweep's time budget and delay every other workload
   * sharing the runner.
   */
  readonly requestTimeoutMs?: Maybe<number>;
  /**
   * Passthrough for parameters this interface does not yet name.
   */
  readonly [key: string]: unknown;
}

/**
 * Merges model configs left-to-right, so the last input wins.
 *
 * Merging is SHALLOW by key: an override that supplies `provider` replaces the whole provider object
 * rather than merging into it. That is the behaviour a caller wants — a half-overridden `provider`
 * (say, `only` from the override and `allowFallbacks` from the version) is a configuration nobody
 * wrote down and nobody can reason about.
 *
 * `undefined` values do not overwrite; an explicit `null` does (it is how a caller clears a value
 * the version set).
 *
 * @param configs - Configs to merge, lowest priority first.
 * @returns The merged config.
 */
export function mergeOpenRouterModelConfig(configs: Maybe<OpenRouterModelConfig>[]): OpenRouterModelConfig {
  return mergeObjects<OpenRouterModelConfig>(configs) as OpenRouterModelConfig;
}

/**
 * Result of validating an {@link OpenRouterModelConfig}.
 */
export interface OpenRouterModelConfigValidation {
  /**
   * Whether the config is usable as-is.
   */
  readonly valid: boolean;
  /**
   * Problems that make the config unusable.
   */
  readonly errors: string[];
  /**
   * Problems that do not prevent the call but will very likely produce a wrong result.
   */
  readonly warnings: string[];
}

/**
 * Validates a merged model config, catching the misconfigurations that fail silently at runtime
 * rather than loudly.
 *
 * @param config - The merged config to check.
 * @returns The validation result.
 */
export function validateOpenRouterModelConfig(config: Maybe<OpenRouterModelConfig>): OpenRouterModelConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config == null) {
    errors.push('No model config was provided.');
  } else {
    if (!config.model && !config.models?.length) {
      errors.push('No `model` (or `models` fallback chain) was specified.');
    }

    const format = config.text?.format;

    if (format?.type === 'json_schema') {
      if (!format.name) {
        errors.push('A `json_schema` text format requires a `name`.');
      }

      if (!format.schema) {
        errors.push('A `json_schema` text format requires a `schema`.');
      }
    }

    const fileParser = config.plugins?.find((x) => x.id === 'file-parser') as Maybe<OpenRouterFileParserPluginConfig>;

    if (fileParser != null && !fileParser.pdf?.engine) {
      warnings.push('The `file-parser` plugin has no pinned `pdf.engine`; OpenRouter will silently fall back to `mistral-ocr` (8-image cap, per-page billing) on any model it believes lacks native file support.');
    }

    const hasHostedTools = (config.tools?.length ?? 0) > 0;
    const fileSearchWithoutStores = config.tools?.some((x) => x.type === 'file_search' && !Array.isArray(x['vectorStoreIds']));

    if (fileSearchWithoutStores) {
      // The SDK drops an unrecognized field (a `vector_store_ids` authored in wire case, say) during
      // outbound serialization, leaving a tool that searches nothing and a model that answers ungrounded
      // with no error at all. That is exactly the failure worth refusing to publish.
      errors.push('A `file_search` hosted tool requires a `vectorStoreIds` array. Note the CAMELCASE — the SDK drops the wire-cased `vector_store_ids`, leaving a tool that searches nothing.');
    }

    if (hasHostedTools && config.provider?.requireParameters !== true) {
      warnings.push('Hosted tools were requested without `provider.requireParameters: true`; a provider that does not support them receives only the parameters it supports and ignores the rest, returning an ungrounded answer with no error.');
    }

    if (config.provider?.only?.length && config.provider.allowFallbacks !== false) {
      warnings.push('`provider.only` was set without `provider.allowFallbacks: false`, so routing can still leave the pinned provider.');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
