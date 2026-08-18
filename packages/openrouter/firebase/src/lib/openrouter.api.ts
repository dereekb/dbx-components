import { type Type, type } from 'arktype';
import { type FirebaseFunctionTypeConfigMap, type FirestoreModelKey, type InferredTargetModelParams, type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseQueryFunction, type OnCallCreateModelResult, type OnCallQueryModelRequestParams, type OnCallQueryModelResult, callModelFirebaseFunctionMapFactory, inferredTargetModelParamsType } from '@dereekb/firebase';
import { clearable } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterPromptVersionNumber } from '@dereekb/openrouter';
import { type OpenRouterPrompt, type OpenRouterPromptState, type OpenRouterPromptTypes } from './openrouter.model';

// MARK: Update
/**
 * Parameters for updating an {@link OpenRouterPrompt}'s metadata and lifecycle state.
 *
 * Notably absent: anything that would change what a version SAYS. That is the version model's own
 * update, so the only writes here are to the prompt's metadata and to which version is active.
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
    'name?': clearable('string'),
    'description?': clearable('string'),
    'tags?': clearable('string[]'),
    'state?': clearable('number'),
    'activeVersion?': clearable('number')
  })
) as Type<UpdateOpenRouterPromptParams>;

// MARK: Create Version
/**
 * A seed message supplied when creating a version.
 */
export interface OpenRouterPromptVersionMessageParams {
  readonly role: 'user' | 'system' | 'assistant' | 'developer';
  readonly content: string;
}

export const openRouterPromptVersionMessageParamsType = /* @__PURE__ */ type({
  role: "'user' | 'system' | 'assistant' | 'developer'",
  content: 'string'
}) as Type<OpenRouterPromptVersionMessageParams>;

/**
 * Parameters for creating a new {@link OpenRouterPromptVersion}.
 *
 * A create on the version model rather than an update on its parent: publishing writes a new document,
 * which is what a create is, and it puts the operation on the model whose document appears. It also locks
 * the version it succeeds — see {@link OpenRouterPromptVersion}.
 *
 * The version number is ALLOCATED by the server from the prompt's `lv`, not supplied — two concurrent
 * creates picking the same number would silently overwrite one another. That is also why the parent is
 * named here rather than inferred: the target of the call is a document that does not exist yet.
 *
 * @dbxModelApiParams
 */
export interface CreateOpenRouterPromptVersionParams {
  /**
   * Key of the {@link OpenRouterPrompt} the version belongs to.
   */
  readonly prompt: FirestoreModelKey;
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
   * Why this version was created.
   */
  readonly notes?: Maybe<string>;
  /**
   * Whether to promote this version to `activeVersion` on creation.
   *
   * Defaults to false: publishing and promoting are separate acts, so a version can be tested by a
   * pinned caller before it becomes what everyone gets.
   */
  readonly activate?: Maybe<boolean>;
}

export const createOpenRouterPromptVersionParamsType = /* @__PURE__ */ type({
  prompt: 'string >= 1',
  'instructions?': clearable('string'),
  'messages?': clearable(openRouterPromptVersionMessageParamsType.array()),
  'config?': clearable('object'),
  'notes?': clearable('string'),
  'activate?': clearable('boolean')
}) as Type<CreateOpenRouterPromptVersionParams>;

// MARK: Update Version
/**
 * Parameters for updating the latest {@link OpenRouterPromptVersion} of a prompt.
 *
 * Only what a version SAYS is editable, and only while the version is the latest one. Creating the
 * next version locks this one, and a locked version is refused — see {@link OpenRouterPromptVersion}
 * for why. The version number, its creation date and its lock are not caller-writable.
 *
 * @dbxModelApiParams
 */
export interface UpdateOpenRouterPromptVersionParams extends InferredTargetModelParams {
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
   * Why the version says what it says.
   */
  readonly notes?: Maybe<string>;
}

export const updateOpenRouterPromptVersionParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    'instructions?': clearable('string'),
    'messages?': clearable(openRouterPromptVersionMessageParamsType.array()),
    'config?': clearable('object'),
    'notes?': clearable('string')
  })
) as Type<UpdateOpenRouterPromptVersionParams>;

/**
 * Result of updating a version.
 */
export interface UpdateOpenRouterPromptVersionResult {
  /**
   * Config problems that did not prevent the edit from being written.
   *
   * Returned for the same reason the create returns them: an unpinned PDF engine or an unpinned
   * provider produces a wrong answer rather than an error, so an edit that introduces one has to say so.
   */
  readonly warnings: string[];
}

/**
 * Result of creating a version.
 */
export interface CreateOpenRouterPromptVersionResult extends OnCallCreateModelResult {
  /**
   * Key of the created version document.
   */
  readonly modelKeys: [FirestoreModelKey];
  /**
   * The allocated version number.
   */
  readonly version: OpenRouterPromptVersionNumber;
  /**
   * Whether the version was promoted to active.
   */
  readonly activated: boolean;
  /**
   * Config problems that did not prevent the version from being written.
   *
   * Surfaced rather than swallowed: an unpinned PDF engine or an unpinned provider produces a wrong
   * answer rather than an error, so the warning is the only chance to notice.
   */
  readonly warnings: string[];
}

// MARK: Query
/**
 * Parameters for querying {@link OpenRouterPrompt}s.
 *
 * The standard query operation rather than a bespoke list endpoint: it inherits `limit` and
 * `cursorDocumentKey` pagination that every client and the callModel MCP already know how to drive,
 * and returns the stored documents rather than a hand-maintained projection of them.
 *
 * @dbxModelApiParams
 */
export interface QueryOpenRouterPromptsParams extends OnCallQueryModelRequestParams {
  /**
   * Restrict to one lifecycle state. Omit to page through every prompt.
   *
   * The only filter axis, deliberately — see {@link openRouterPromptsWithStateQuery}.
   */
  readonly state?: Maybe<OpenRouterPromptState>;
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
 * A prompt has no `create` of its own: it is created server-side, from a seed against an
 * {@link OpenRouterPromptDefinition} the code already carries. A VERSION does, because publishing one
 * writes a new document, and the create sits on `openRouterPromptVersion` — the model whose document
 * appears — rather than as a specifier on the parent's update. Its `update` edits the latest version
 * in place and refuses a locked one, so iterating on a prompt does not mint a version per keystroke.
 *
 * Neither model declares a `read`: both are registered model services, so a stored prompt or one of its
 * versions is already fetchable by key through model-get.
 *
 * `OpenRouterRunTask` is absent on purpose. A run task is written and drained entirely server-side, and
 * its `msg` field carries raw model input and output.
 */
export type OpenRouterPromptModelCrudFunctionsConfig = {
  readonly openRouterPrompt: {
    update: UpdateOpenRouterPromptParams;
    query: [QueryOpenRouterPromptsParams, OnCallQueryModelResult<OpenRouterPrompt>];
  };
  readonly openRouterPromptVersion: {
    create: [CreateOpenRouterPromptVersionParams, CreateOpenRouterPromptVersionResult];
    update: [UpdateOpenRouterPromptVersionParams, UpdateOpenRouterPromptVersionResult];
  };
};

export const OPENROUTER_PROMPT_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<OpenRouterPromptModelCrudFunctionsConfig, OpenRouterPromptTypes> = {
  openRouterPrompt: ['update', 'query'],
  openRouterPromptVersion: ['create', 'update']
};

/**
 * Abstract class defining the callable OpenRouter prompt functions.
 */
export abstract class OpenRouterPromptModelFunctions implements ModelFirebaseFunctionMap<OpenRouterPromptFunctionTypeMap, OpenRouterPromptModelCrudFunctionsConfig> {
  abstract openRouterPrompt: {
    updateOpenRouterPrompt: ModelFirebaseCrudFunction<UpdateOpenRouterPromptParams>;
    queryOpenRouterPrompt: ModelFirebaseQueryFunction<QueryOpenRouterPromptsParams, OnCallQueryModelResult<OpenRouterPrompt>>;
  };
  abstract openRouterPromptVersion: {
    createOpenRouterPromptVersion: ModelFirebaseCreateFunction<CreateOpenRouterPromptVersionParams, CreateOpenRouterPromptVersionResult>;
    updateOpenRouterPromptVersion: ModelFirebaseCrudFunction<UpdateOpenRouterPromptVersionParams, UpdateOpenRouterPromptVersionResult>;
  };
}

/**
 * Client-side callable function map factory for OpenRouter prompt CRUD.
 */
export const openRouterPromptModelFunctionMap = callModelFirebaseFunctionMapFactory(OPENROUTER_PROMPT_FUNCTION_TYPE_CONFIG_MAP, OPENROUTER_PROMPT_MODEL_CRUD_FUNCTIONS_CONFIG);
