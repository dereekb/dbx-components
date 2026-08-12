import { type Type, type } from 'arktype';
import { type FirebaseFunctionTypeConfigMap, type FirestoreModelKey, type InferredTargetModelParams, type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, callModelFirebaseFunctionMapFactory, inferredTargetModelParamsType } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterPromptKey, type OpenRouterPromptVersionNumber } from '@dereekb/openrouter';
import { type OpenRouterPromptState, type openRouterPromptIdentity } from './openrouter.prompt';

// MARK: Create
/**
 * Parameters for creating an {@link OpenRouterPrompt}.
 *
 * The key IS the document id, so it is supplied rather than generated — the point of the model is that
 * a call site names its prompt in readable text.
 *
 * @dbxModelApiParams
 */
export interface CreateOpenRouterPromptParams {
  /**
   * The prompt key, used as the document id. Lowercase, dash-separated by convention.
   */
  readonly key: OpenRouterPromptKey;
  /**
   * Human-readable name.
   */
  readonly name: string;
  /**
   * What the prompt is for.
   */
  readonly description?: Maybe<string>;
  /**
   * Grouping tags.
   */
  readonly tags?: Maybe<string[]>;
}

export const createOpenRouterPromptParamsType = /* @__PURE__ */ type({
  key: 'string >= 1',
  name: 'string >= 1',
  'description?': 'string | null | undefined',
  'tags?': 'string[] | null | undefined'
}) as Type<CreateOpenRouterPromptParams>;

// MARK: Update
/**
 * Parameters for updating an {@link OpenRouterPrompt}'s metadata and lifecycle state.
 *
 * Notably absent: anything that would change what a version SAYS. Versions are immutable, so the only
 * writes here are to the prompt's own metadata and to which version is active.
 *
 * @dbxModelApiParams
 */
export interface UpdateOpenRouterPromptParams extends InferredTargetModelParams {
  readonly name?: Maybe<string>;
  readonly description?: Maybe<string>;
  readonly tags?: Maybe<string[]>;
  /**
   * New lifecycle state.
   */
  readonly state?: Maybe<OpenRouterPromptState>;
  /**
   * Version to serve to unpinned callers.
   *
   * Must already exist — promoting a version that was never published would leave every unpinned caller
   * failing to resolve.
   */
  readonly activeVersion?: Maybe<OpenRouterPromptVersionNumber>;
}

export const updateOpenRouterPromptParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    'name?': 'string | null | undefined',
    'description?': 'string | null | undefined',
    'tags?': 'string[] | null | undefined',
    'state?': 'number | null | undefined',
    'activeVersion?': 'number | null | undefined'
  })
) as Type<UpdateOpenRouterPromptParams>;

/**
 * A seed message supplied when publishing a version.
 */
export interface OpenRouterPromptVersionMessageParams {
  readonly role: 'user' | 'system' | 'assistant' | 'developer';
  readonly content: string;
}

/**
 * Parameters for publishing a new {@link OpenRouterPromptVersion}.
 *
 * The version number is ALLOCATED by the server from the prompt's `lv`, not supplied — two concurrent
 * publishes picking the same number would silently overwrite one another.
 *
 * @dbxModelApiParams
 */
export interface PublishOpenRouterPromptVersionParams extends InferredTargetModelParams {
  /**
   * System prompt.
   */
  readonly instructions?: Maybe<string>;
  /**
   * Static seed messages.
   */
  readonly messages?: Maybe<OpenRouterPromptVersionMessageParams[]>;
  /**
   * Model configuration. Passthrough JSON — validated against `OpenRouterModelConfig` but stored as-is.
   */
  readonly config?: Maybe<Record<string, unknown>>;
  /**
   * Why this version was published.
   */
  readonly notes?: Maybe<string>;
  /**
   * Whether to promote this version to `activeVersion` on publish.
   *
   * Defaults to false: publishing and promoting are separate acts, so a version can be tested by a
   * pinned caller before it becomes what everyone gets.
   */
  readonly activate?: Maybe<boolean>;
}

export const publishOpenRouterPromptVersionParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    'instructions?': 'string | null | undefined',
    'messages?': type({ role: "'user' | 'system' | 'assistant' | 'developer'", content: 'string' }).array().or('null | undefined'),
    'config?': 'object | null | undefined',
    'notes?': 'string | null | undefined',
    'activate?': 'boolean | null | undefined'
  })
) as Type<PublishOpenRouterPromptVersionParams>;

/**
 * Result of publishing a version.
 */
export interface PublishOpenRouterPromptVersionResult {
  /**
   * The allocated version number.
   */
  readonly version: OpenRouterPromptVersionNumber;
  /**
   * The version document's key.
   */
  readonly key: FirestoreModelKey;
  /**
   * Whether the version was promoted to active.
   */
  readonly activated: boolean;
  /**
   * Config problems that did not prevent publishing.
   *
   * Surfaced rather than swallowed: an unpinned PDF engine or an unpinned provider produces a wrong
   * answer rather than an error, so the warning is the only chance to notice.
   */
  readonly warnings: string[];
}

// MARK: Read
/**
 * Parameters for reading a prompt and one of its versions.
 *
 * @dbxModelApiParams
 */
export interface ReadOpenRouterPromptParams extends InferredTargetModelParams {
  /**
   * Version to read. Omit for the active version.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * Whether to include the list of published version numbers.
   */
  readonly includeVersions?: Maybe<boolean>;
}

export const readOpenRouterPromptParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    'version?': 'number | null | undefined',
    'includeVersions?': 'boolean | null | undefined'
  })
) as Type<ReadOpenRouterPromptParams>;

/**
 * Result of reading a prompt.
 */
export interface ReadOpenRouterPromptResult {
  readonly key: OpenRouterPromptKey;
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly state: OpenRouterPromptState;
  readonly activeVersion?: Maybe<OpenRouterPromptVersionNumber>;
  readonly latestVersion: OpenRouterPromptVersionNumber;
  readonly tags?: Maybe<string[]>;
  /**
   * The resolved version, when one could be resolved.
   */
  readonly version?: Maybe<{
    readonly version: OpenRouterPromptVersionNumber;
    readonly instructions?: Maybe<string>;
    readonly messages?: Maybe<OpenRouterPromptVersionMessageParams[]>;
    readonly config?: Maybe<Record<string, unknown>>;
    readonly notes?: Maybe<string>;
  }>;
  /**
   * Every published version number, when requested.
   */
  readonly versions?: Maybe<OpenRouterPromptVersionNumber[]>;
}

/**
 * Parameters for listing prompts.
 *
 * @dbxModelApiParams
 */
export interface ListOpenRouterPromptsParams {
  /**
   * Restrict to one lifecycle state.
   */
  readonly state?: Maybe<OpenRouterPromptState>;
  /**
   * Restrict to prompts carrying this tag.
   */
  readonly tag?: Maybe<string>;
  /**
   * Maximum number of prompts to return.
   */
  readonly limit?: Maybe<number>;
}

export const listOpenRouterPromptsParamsType = /* @__PURE__ */ type({
  'state?': 'number | null | undefined',
  'tag?': 'string | null | undefined',
  'limit?': 'number | null | undefined'
}) as Type<ListOpenRouterPromptsParams>;

/**
 * Result of listing prompts.
 */
export interface ListOpenRouterPromptsResult {
  readonly prompts: {
    readonly key: OpenRouterPromptKey;
    readonly name: string;
    readonly state: OpenRouterPromptState;
    readonly activeVersion?: Maybe<OpenRouterPromptVersionNumber>;
    readonly latestVersion: OpenRouterPromptVersionNumber;
    readonly tags?: Maybe<string[]>;
  }[];
}

// MARK: Run Task
/**
 * Parameters for reading an {@link OpenRouterRunTask}.
 *
 * @dbxModelApiParams
 */
export interface ReadOpenRouterRunTaskParams {
  /**
   * The run key.
   */
  readonly key: string;
}

export const readOpenRouterRunTaskParamsType = /* @__PURE__ */ type({ key: 'string >= 1' }) as Type<ReadOpenRouterRunTaskParams>;

// MARK: Functions
/**
 * Custom (non-CRUD) function type map for OpenRouter prompts.
 */
export type OpenRouterPromptFunctionTypeMap = {};

export const OPENROUTER_PROMPT_FUNCTION_TYPE_CONFIG_MAP: FirebaseFunctionTypeConfigMap<OpenRouterPromptFunctionTypeMap> = {};

/**
 * CRUD function configuration map for {@link OpenRouterPrompt}.
 *
 * There is deliberately no Angular UI for prompt authoring: declaring the CRUD here is what makes every
 * prompt operation reachable over an app's existing callModel surface — including from the callModel
 * MCP — instead of requiring a screen to be built for it.
 *
 * `OpenRouterRunTask` is absent on purpose. A run task is written and drained entirely server-side, and
 * its `msg` field carries raw model input and output.
 */
export type OpenRouterPromptModelCrudFunctionsConfig = {
  readonly openRouterPrompt: {
    create: CreateOpenRouterPromptParams;
    read: {
      _: [ReadOpenRouterPromptParams, ReadOpenRouterPromptResult];
      list: [ListOpenRouterPromptsParams, ListOpenRouterPromptsResult];
    };
    update: {
      _: UpdateOpenRouterPromptParams;
      publishVersion: [PublishOpenRouterPromptVersionParams, PublishOpenRouterPromptVersionResult];
    };
  };
};

export const OPENROUTER_PROMPT_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<OpenRouterPromptModelCrudFunctionsConfig, typeof openRouterPromptIdentity> = {
  openRouterPrompt: ['create', 'read:_,list', 'update:_,publishVersion']
};

/**
 * Abstract class defining the callable OpenRouter prompt functions.
 */
export abstract class OpenRouterPromptModelFunctions implements ModelFirebaseFunctionMap<OpenRouterPromptFunctionTypeMap, OpenRouterPromptModelCrudFunctionsConfig> {
  abstract openRouterPrompt: {
    createOpenRouterPrompt: ModelFirebaseCreateFunction<CreateOpenRouterPromptParams>;
    readOpenRouterPrompt: {
      read: ModelFirebaseCrudFunction<ReadOpenRouterPromptParams, ReadOpenRouterPromptResult>;
      list: ModelFirebaseCrudFunction<ListOpenRouterPromptsParams, ListOpenRouterPromptsResult>;
    };
    updateOpenRouterPrompt: {
      update: ModelFirebaseCrudFunction<UpdateOpenRouterPromptParams>;
      publishVersion: ModelFirebaseCrudFunction<PublishOpenRouterPromptVersionParams, PublishOpenRouterPromptVersionResult>;
    };
  };
}

/**
 * Client-side callable function map factory for OpenRouter prompt CRUD.
 */
export const openRouterPromptModelFunctionMap = callModelFirebaseFunctionMapFactory(OPENROUTER_PROMPT_FUNCTION_TYPE_CONFIG_MAP, OPENROUTER_PROMPT_MODEL_CRUD_FUNCTIONS_CONFIG);
