import { type Type, type } from 'arktype';
import {
  type FirebaseFunctionTypeConfigMap,
  type FirestoreModelKey,
  type InferredTargetModelParams,
  type ModelFirebaseCreateFunction,
  type ModelFirebaseCrudFunction,
  type ModelFirebaseCrudFunctionConfigMap,
  type ModelFirebaseFunctionMap,
  type ModelFirebaseQueryFunction,
  type OnCallCreateModelResult,
  type OnCallQueryModelRequestParams,
  type OnCallQueryModelResult,
  callModelFirebaseFunctionMapFactory,
  inferredTargetModelParamsType,
  onCallQueryModelRequestParamsType
} from '@dereekb/firebase';
import { clearable } from '@dereekb/model';
import { type Maybe, type SmsTextEncoding } from '@dereekb/util';
import { type OpenRouterPromptKey, type OpenRouterPromptResolutionSource, type OpenRouterPromptVersionNumber, type OpenRouterResolvedPrompt, type OpenRouterTemplateBodyResultKind, type OpenRouterTemplateReviewRecord, type OpenRouterTemplateScriptError, type OpenRouterTemplateTypeKey } from '@dereekb/openrouter';
import { type OpenRouterPrompt, OpenRouterPromptState, type OpenRouterPromptTypes } from './openrouter.model';

// MARK: State
/**
 * ArkType validator for {@link OpenRouterPromptState}.
 *
 * A state is stored and queried by its number, so a value outside the enum, such as the name `"ACTIVE"`, is refused with
 * the allowed numbers listed rather than quietly matching no prompt.
 */
export const openRouterPromptStateType = /* @__PURE__ */ type.enumerated(OpenRouterPromptState.DRAFT, OpenRouterPromptState.ACTIVE, OpenRouterPromptState.ARCHIVED);

// MARK: Create Template
/**
 * Parameters for creating a message TEMPLATE: an {@link OpenRouterPrompt} of a template type registered in code.
 *
 * The one create on the prompt model, and it is template-only: a plain prompt still comes into existence from a seed against
 * its code definition. A template is created at runtime so an admin can add one of an existing type without a deploy. The
 * type cannot change after, and the key must not belong to a code template or an existing prompt.
 *
 * @dbxModelApiParams
 */
export interface CreateOpenRouterTemplateParams {
  /**
   * The template key, used as the prompt's document id. Lowercase, dash-separated by convention.
   */
  readonly key: OpenRouterPromptKey;
  /**
   * Human-readable name.
   */
  readonly name: string;
  /**
   * What the template is for.
   */
  readonly description?: Maybe<string>;
  /**
   * Grouping tags.
   */
  readonly tags?: Maybe<string[]>;
  /**
   * The registered template type. Its mode, input, loaders and output rules govern every version.
   */
  readonly templateType: OpenRouterTemplateTypeKey;
}

export const createOpenRouterTemplateParamsType = /* @__PURE__ */ type({
  key: 'string >= 1',
  name: 'string >= 1',
  'description?': clearable('string'),
  'tags?': clearable('string[]'),
  templateType: 'string >= 1'
}) as Type<CreateOpenRouterTemplateParams>;

/**
 * Details carried by the error a refused template version or preview throws.
 *
 * Structured so an author can see each problem where it is: parser errors keep their line and column, and a flagged review
 * names the questions it flagged.
 */
export interface OpenRouterTemplateCheckErrorData {
  /**
   * Shape, config and runtime problems.
   */
  readonly errors: string[];
  /**
   * The body script's static check errors.
   */
  readonly scriptErrors?: Maybe<OpenRouterTemplateScriptError[]>;
  /**
   * The final script's static check errors.
   */
  readonly finalScriptErrors?: Maybe<OpenRouterTemplateScriptError[]>;
  /**
   * The review questions that were flagged.
   */
  readonly flagged?: Maybe<string[]>;
}

/**
 * Error code a refused template version or preview throws with.
 */
export const OPENROUTER_TEMPLATE_CHECK_FAILED_ERROR_CODE = 'OPENROUTER_TEMPLATE_CHECK_FAILED';

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
  /**
   * Whether the prompt is locked to the store, so a code definition can neither seed it nor overtake it.
   *
   * The one write that turns the lever on and off, and it is deliberately here rather than only on a
   * definition: locking a prompt is an operator's decision about who maintains its content, and an
   * operator has to be able to take that decision back.
   */
  readonly storeLocked?: Maybe<boolean>;
}

export const updateOpenRouterPromptParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    'name?': clearable('string'),
    'description?': clearable('string'),
    'tags?': clearable('string[]'),
    'state?': clearable(openRouterPromptStateType),
    'activeVersion?': clearable('number'),
    'storeLocked?': clearable('boolean')
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
   * The questions this version declares, making it a DECISION prompt.
   *
   * Passthrough JSON, validated against the declaration guards before the version is written — an
   * eleven-level Score or a question with blank instructions is refused here rather than at the wire.
   * A version carrying questions must also name a System One model in its config.
   */
  readonly questions?: Maybe<Record<string, unknown>>;
  /**
   * The template body script, when the prompt is a template.
   *
   * A version carrying any script is written only when every check passes — the shape rules of the type's mode, the static
   * script checks and the review — and is then approved by the server. A failure refuses the write.
   */
  readonly script?: Maybe<string>;
  /**
   * The template final script, run on a model's output. Allowed only when the template's type declares a `finalScript`
   * setting.
   */
  readonly finalScript?: Maybe<string>;
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
  'questions?': clearable('object'),
  'script?': clearable('string'),
  'finalScript?': clearable('string'),
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
   * The questions this version declares, making it a DECISION prompt. See
   * {@link CreateOpenRouterPromptVersionParams.questions}.
   */
  readonly questions?: Maybe<Record<string, unknown>>;
  /**
   * The template body script. See {@link CreateOpenRouterPromptVersionParams.script}.
   */
  readonly script?: Maybe<string>;
  /**
   * The template final script. See {@link CreateOpenRouterPromptVersionParams.finalScript}.
   */
  readonly finalScript?: Maybe<string>;
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
    'questions?': clearable('object'),
    'script?': clearable('string'),
    'finalScript?': clearable('string'),
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
  /**
   * The review of a template version that carries a script.
   */
  readonly review?: Maybe<OpenRouterTemplateReviewRecord>;
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
  /**
   * The review of a template version that carries a script.
   */
  readonly review?: Maybe<OpenRouterTemplateReviewRecord>;
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

/**
 * ArkType validator for {@link QueryOpenRouterPromptsParams}.
 */
export const queryOpenRouterPromptsParamsType = /* @__PURE__ */ onCallQueryModelRequestParamsType.merge({
  'state?': clearable(openRouterPromptStateType)
}) as Type<QueryOpenRouterPromptsParams>;

// MARK: Read
/**
 * Parameters for reading an {@link OpenRouterPrompt} together with the version it serves.
 *
 * @dbxModelApiParams
 */
export interface ReadOpenRouterPromptParams extends InferredTargetModelParams {
  /**
   * The version to read. Omit to read the version an unpinned caller is served right now.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
}

export const readOpenRouterPromptParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    'version?': 'number'
  })
) as Type<ReadOpenRouterPromptParams>;

/**
 * Result of reading a prompt.
 *
 * Returns the RESOLVED version rather than a stored document, because the stored document is not
 * necessarily what the app serves: a code {@link OpenRouterPromptDefinition} stands in when the store
 * cannot serve, or is behind it. Reading the two documents by key would answer "what is stored", which
 * is a different — and, when they disagree, misleading — question from "what will run".
 */
export interface ReadOpenRouterPromptResult {
  /**
   * The stored prompt document, or null when the prompt exists only as a code definition.
   *
   * Null here alongside a populated {@link resolved} is the never-seeded case, not an error.
   */
  readonly prompt: Maybe<OpenRouterPrompt>;
  /**
   * The version that will actually be served — instructions, seed messages, and model config.
   *
   * This is the read the version model could not previously give back: a version could be written and
   * never read, so an author edited a prompt blind.
   */
  readonly resolved: OpenRouterResolvedPrompt;
  /**
   * Which half of the resolution won: the stored version, or the code definition standing in for it.
   *
   * The one field that makes the precedence rule observable. A caller who published version 3 and is
   * still being served version 4 from code sees `definition` here rather than having to rederive why.
   */
  readonly source: OpenRouterPromptResolutionSource;
  /**
   * Config problems that do not stop the prompt from being served.
   *
   * Same warnings a create or update returns, reported here so a prompt that was published before a
   * validation rule existed still surfaces them on read.
   */
  readonly warnings: string[];
  /**
   * Config problems that make {@link resolved} unusable.
   *
   * Separate from {@link warnings}, and non-empty only in cases a create would have refused. A read
   * still returns rather than throwing on them: the resolver rejects an invalid config only when it is
   * configured with `rejectInvalidConfig`, so such a version CAN be the live one — and showing the
   * caller the config that is breaking their calls is the entire point of the read.
   */
  readonly errors: string[];
}

// MARK: Preview Template
/**
 * A draft to preview in place of what a stored template version says. Each field left out keeps the version's own.
 */
export interface PreviewOpenRouterTemplateDraftParams {
  readonly script?: Maybe<string>;
  readonly finalScript?: Maybe<string>;
  readonly instructions?: Maybe<string>;
  readonly messages?: Maybe<OpenRouterPromptVersionMessageParams[]>;
  readonly config?: Maybe<Record<string, unknown>>;
}

export const previewOpenRouterTemplateDraftParamsType = /* @__PURE__ */ type({
  'script?': clearable('string'),
  'finalScript?': clearable('string'),
  'instructions?': clearable('string'),
  'messages?': clearable(openRouterPromptVersionMessageParamsType.array()),
  'config?': clearable('object')
}) as Type<PreviewOpenRouterTemplateDraftParams>;

/**
 * A model output to feed a final script, so it can be previewed without paying for a model call.
 */
export interface PreviewOpenRouterTemplateModelOutputParams {
  readonly text?: Maybe<string>;
  readonly json?: Maybe<unknown>;
}

/**
 * Parameters for previewing a template through the real render path.
 *
 * An `invoke` rather than a `read`, because it can spend money: with `callModel` it makes the model call a render would.
 * Without it, the render stops before the call and feeds a final script `modelOutput` (or the type's sample output).
 *
 * @dbxModelApiParams
 */
export interface PreviewOpenRouterTemplateParams extends InferredTargetModelParams {
  /**
   * The version to preview. Omit for the active version.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * A draft to preview instead of the stored version. It runs only once its static checks pass.
   */
  readonly draft?: Maybe<PreviewOpenRouterTemplateDraftParams>;
  /**
   * The template input. Defaults to the type's sample input.
   */
  readonly input?: Maybe<Record<string, unknown>>;
  /**
   * Data that stands in for the loaders, keyed by loader name. Defaults to the type's sample loader data.
   */
  readonly loaderData?: Maybe<Record<string, unknown>>;
  /**
   * The model output to feed a final script when the model is not called. Defaults to the type's sample output.
   */
  readonly modelOutput?: Maybe<PreviewOpenRouterTemplateModelOutputParams>;
  /**
   * Whether to run the review too. Costs a model call.
   */
  readonly review?: Maybe<boolean>;
  /**
   * Whether to make the model call a render would. Defaults to false.
   */
  readonly callModel?: Maybe<boolean>;
}

export const previewOpenRouterTemplateParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    'version?': clearable('number'),
    'draft?': clearable(previewOpenRouterTemplateDraftParamsType),
    'input?': clearable('object'),
    'loaderData?': clearable('object'),
    'modelOutput?': clearable(type({ 'text?': clearable('string'), 'json?': 'unknown' })),
    'review?': clearable('boolean'),
    'callModel?': clearable('boolean')
  })
) as Type<PreviewOpenRouterTemplateParams>;

/**
 * The rendered output of a preview.
 */
export interface PreviewOpenRouterTemplateOutput {
  /**
   * The message text, when the render produced one.
   */
  readonly text?: Maybe<string>;
  /**
   * Whether the render produced no message, which means nothing would be sent.
   */
  readonly empty: boolean;
  /**
   * What the body returned: text, OpenRouter details, or nothing.
   */
  readonly path: OpenRouterTemplateBodyResultKind;
  /**
   * The OpenRouter input the body handed off, when it did.
   */
  readonly openRouterInput?: Maybe<string>;
  /**
   * Whether the model was called.
   */
  readonly modelCalled: boolean;
  /**
   * Whether a final script (or a code template's `finalize`) produced the text.
   */
  readonly finalized: boolean;
  /**
   * The text's length.
   */
  readonly length: number;
  /**
   * The SMS encoding the text needs.
   */
  readonly encoding: SmsTextEncoding;
  /**
   * The number of SMS segments the text takes.
   */
  readonly segments: number;
}

/**
 * Result of previewing a template.
 */
export interface PreviewOpenRouterTemplateResult extends OpenRouterTemplateCheckErrorData {
  /**
   * Whether every check passed and the render succeeded.
   */
  readonly valid: boolean;
  /**
   * Problems that would not stop a publish.
   */
  readonly warnings: string[];
  /**
   * The review, when one was asked for.
   */
  readonly review?: Maybe<OpenRouterTemplateReviewRecord>;
  /**
   * The rendered output, when the render ran.
   */
  readonly output?: Maybe<PreviewOpenRouterTemplateOutput>;
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
 * A plain prompt has no `create` of its own: it is created server-side, from a seed against an
 * {@link OpenRouterPromptDefinition} the code already carries. The prompt's one create is `create:template`, which makes a
 * message TEMPLATE of a type registered in code, so an admin can add one at runtime without a deploy. A VERSION has a create, because publishing one
 * writes a new document, and the create sits on `openRouterPromptVersion` — the model whose document
 * appears — rather than as a specifier on the parent's update. Its `update` edits the latest version
 * in place and refuses a locked one, so iterating on a prompt does not mint a version per keystroke.
 *
 * The prompt declares a `read` on top of model-get, because model-get answers a different question: it
 * returns the stored DOCUMENT, which holds only pointers (`av`, `lv`) and none of what the prompt says.
 * Following it by hand means reading the version subcollection at a zero-padded id the caller has to
 * construct, and still leaves the code-definition fallback invisible. The `read` returns what will
 * actually be served, and says which half of the resolution produced it.
 *
 * The VERSION declares no `read`: it is a registered model service, so a specific stored version is
 * already fetchable by key through model-get, and the prompt's `read` covers the "what is live" case.
 *
 * `OpenRouterRunTask` is absent on purpose. A run task is written and drained entirely server-side, and
 * its `msg` field carries raw model input and output.
 */
export type OpenRouterPromptModelCrudFunctionsConfig = {
  readonly openRouterPrompt: {
    create: {
      /**
       * Admin-only. Creates a message template of a registered type.
       */
      template: [CreateOpenRouterTemplateParams, OnCallCreateModelResult];
    };
    read: [ReadOpenRouterPromptParams, ReadOpenRouterPromptResult];
    update: UpdateOpenRouterPromptParams;
    query: [QueryOpenRouterPromptsParams, OnCallQueryModelResult<OpenRouterPrompt>];
    invoke: {
      /**
       * Admin-only. Previews a template, or a draft of one, through the real render path.
       */
      previewTemplate: [PreviewOpenRouterTemplateParams, PreviewOpenRouterTemplateResult];
    };
  };
  readonly openRouterPromptVersion: {
    create: [CreateOpenRouterPromptVersionParams, CreateOpenRouterPromptVersionResult];
    update: [UpdateOpenRouterPromptVersionParams, UpdateOpenRouterPromptVersionResult];
  };
};

export const OPENROUTER_PROMPT_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<OpenRouterPromptModelCrudFunctionsConfig, OpenRouterPromptTypes> = {
  openRouterPrompt: ['create:template', 'read', 'update', 'query', 'invoke:previewTemplate'],
  openRouterPromptVersion: ['create', 'update']
};

/**
 * Abstract class defining the callable OpenRouter prompt functions.
 */
export abstract class OpenRouterPromptModelFunctions implements ModelFirebaseFunctionMap<OpenRouterPromptFunctionTypeMap, OpenRouterPromptModelCrudFunctionsConfig> {
  abstract openRouterPrompt: {
    createOpenRouterPrompt: {
      template: ModelFirebaseCreateFunction<CreateOpenRouterTemplateParams, OnCallCreateModelResult>;
    };
    readOpenRouterPrompt: ModelFirebaseCrudFunction<ReadOpenRouterPromptParams, ReadOpenRouterPromptResult>;
    updateOpenRouterPrompt: ModelFirebaseCrudFunction<UpdateOpenRouterPromptParams>;
    queryOpenRouterPrompt: ModelFirebaseQueryFunction<QueryOpenRouterPromptsParams, OnCallQueryModelResult<OpenRouterPrompt>>;
    invokeOpenRouterPrompt: {
      previewTemplate: ModelFirebaseCrudFunction<PreviewOpenRouterTemplateParams, PreviewOpenRouterTemplateResult>;
    };
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
