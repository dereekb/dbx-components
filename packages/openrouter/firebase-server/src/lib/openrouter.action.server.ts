import { type FirebaseServerActionsContext, badRequestError, preconditionConflictError } from '@dereekb/firebase-server';
import { type FirebaseAuthUserId, type FirestoreContextReference, type FirestoreModelKey, type OnCallCreateModelResult, firestoreModelId, firestoreModelKeyParentKey, getDocumentSnapshotDataTuples } from '@dereekb/firebase';
import { type Maybe, range, runAsyncTasksForValues, unique } from '@dereekb/util';
import {
  type OpenRouterDecisionQuestions,
  type OpenRouterModelConfig,
  type OpenRouterPromptDefinition,
  type OpenRouterPromptKey,
  type OpenRouterPromptSeedMessage,
  type OpenRouterTemplateReviewRecord,
  type OpenRouterTemplateTypeKey,
  validateOpenRouterDecisionQuestions,
  validateOpenRouterModelConfig
} from '@dereekb/openrouter';
import {
  type CreateOpenRouterTemplateParams,
  type CreateOpenRouterPromptVersionParams,
  type CreateOpenRouterPromptVersionResult,
  type OpenRouterPrompt,
  type OpenRouterPromptDocument,
  type OpenRouterPromptFirestoreCollections,
  OpenRouterPromptState,
  type OpenRouterPromptVersion,
  type OpenRouterPromptVersionDocument,
  type OpenRouterPromptVersionMessageParams,
  type OpenRouterTemplateCheckErrorData,
  type PreviewOpenRouterTemplateParams,
  type PreviewOpenRouterTemplateResult,
  type ReadOpenRouterPromptParams,
  type ReadOpenRouterPromptResult,
  type UpdateOpenRouterPromptParams,
  type UpdateOpenRouterPromptVersionParams,
  type UpdateOpenRouterPromptVersionResult,
  OPENROUTER_TEMPLATE_CHECK_FAILED_ERROR_CODE,
  createOpenRouterPromptVersionParamsType,
  createOpenRouterTemplateParamsType,
  openRouterPromptVersionId,
  openRouterResolvedPromptForVersion,
  previewOpenRouterTemplateParamsType,
  readOpenRouterPromptParamsType,
  updateOpenRouterPromptParamsType,
  updateOpenRouterPromptVersionParamsType
} from '@dereekb/openrouter/firebase';
import { type OpenRouterPromptService } from './openrouter.prompt.service';
import { openRouterTemplateApprovalPayload } from './openrouter.template.approval';
import { type OpenRouterTemplateService, type OpenRouterTemplateVersionContent, checkOpenRouterTemplateVersionShape, openRouterTemplateVersionContentForResolvedPrompt, openRouterTemplateVersionHasCode } from './openrouter.template.service';

/**
 * Context required by the OpenRouter prompt server actions.
 */
export interface OpenRouterPromptServerActionsContext extends FirebaseServerActionsContext, OpenRouterPromptFirestoreCollections, FirestoreContextReference {
  /**
   * The prompt service, so a publish or promote can drop its cached resolution immediately instead of
   * leaving the change invisible for the cache window.
   */
  readonly openRouterPromptService: OpenRouterPromptService;
  /**
   * The template service. Optional: an app without message templates leaves it out, and every template operation is then
   * refused.
   */
  readonly openRouterTemplateService?: Maybe<OpenRouterTemplateService>;
}

/**
 * Options a version write takes from the request rather than from its params.
 */
export interface OpenRouterPromptVersionWriteOptions {
  /**
   * Uid of the caller, written to the version's `by`. Filled by the handler from `request.auth.uid`, so it can never come
   * from params.
   */
  readonly createdBy?: Maybe<FirebaseAuthUserId>;
}

/**
 * A template key: a document id, so lowercase-friendly and free of slashes.
 */
export const OPENROUTER_TEMPLATE_KEY_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function requireOpenRouterTemplateService(context: OpenRouterPromptServerActionsContext): OpenRouterTemplateService {
  const { openRouterTemplateService } = context;

  if (openRouterTemplateService == null) {
    throw preconditionConflictError({ message: 'Message templates are not configured on this server.' });
  }

  return openRouterTemplateService;
}

function openRouterTemplateCheckFailedError(message: string, data: OpenRouterTemplateCheckErrorData) {
  const details = [
    ...data.errors,
    ...(data.scriptErrors ?? []).map((x) => `script ${x.line ?? '?'}:${x.column ?? '?'} ${x.message}`),
    ...(data.finalScriptErrors ?? []).map((x) => `final script ${x.line ?? '?'}:${x.column ?? '?'} ${x.message}`),
    ...(data.flagged?.length ? [`The review flagged: ${data.flagged.join(', ')}.`] : [])
  ];
  const errorData: OpenRouterTemplateCheckErrorData = { errors: data.errors, scriptErrors: data.scriptErrors, finalScriptErrors: data.finalScriptErrors, flagged: data.flagged };
  return preconditionConflictError({ code: OPENROUTER_TEMPLATE_CHECK_FAILED_ERROR_CODE, message: `${message}: ${details.join(' ')}`, data: errorData });
}

function openRouterPromptVersionKilledError(document: OpenRouterPromptVersionDocument) {
  return preconditionConflictError({ message: `The OpenRouterPromptVersion "${document.key}" was killed, so it can't be edited. Create a new version instead.` });
}

function openRouterSeedMessagesForParams(messages: Maybe<OpenRouterPromptVersionMessageParams[]>): Maybe<OpenRouterPromptSeedMessage[]> {
  return messages?.map(({ role, content }) => ({ role, content }));
}

/**
 * What a template version will say once an update's params are applied over it. A field left undefined keeps the version's own.
 *
 * @param version - The stored version.
 * @param params - The update params.
 * @returns The version content after the update.
 */
function openRouterTemplateVersionContentForUpdate(version: OpenRouterPromptVersion, params: UpdateOpenRouterPromptVersionParams): OpenRouterTemplateVersionContent {
  const stored = openRouterTemplateVersionContentForResolvedPrompt(openRouterResolvedPromptForVersion('', version, ''));

  return {
    script: params.script === undefined ? stored.script : params.script,
    finalScript: params.finalScript === undefined ? stored.finalScript : params.finalScript,
    instructions: params.instructions === undefined ? stored.instructions : params.instructions,
    messages: params.messages === undefined ? stored.messages : openRouterSeedMessagesForParams(params.messages),
    config: params.config === undefined ? version.c : (params.config as Maybe<OpenRouterModelConfig>),
    questions: params.questions === undefined ? stored.questions : (params.questions as Maybe<OpenRouterDecisionQuestions>)
  };
}

/**
 * Parameters for {@link OpenRouterPromptServerActions.createOpenRouterPrompt}.
 *
 * Server-side only, and deliberately not part of the model API: a prompt comes into existence from a
 * seed run against an {@link OpenRouterPromptDefinition} the code already carries, so there is no
 * external caller whose input needs validating.
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

/**
 * Parameters for {@link OpenRouterPromptServerActions.seedOpenRouterPrompts}.
 *
 * Server-side only, and deliberately not part of the model API, for the same reason
 * {@link CreateOpenRouterPromptParams} is not: the only input is a filter over keys the code itself
 * declares, and every caller is server-side. Seeding is also not CRUD on `openRouterPrompt` — exposing
 * it over callModel would hand any admin a button that rewrites prompt pointers.
 */
export interface SeedOpenRouterPromptsParams {
  /**
   * Restrict the run to these keys. Omit to seed every definition the prompt service carries.
   */
  readonly promptKeys?: Maybe<OpenRouterPromptKey[]>;
}

/**
 * Result of {@link OpenRouterPromptServerActions.seedOpenRouterPrompts}.
 *
 * The counts partition the run: `considered === versionsPublished + upToDate + skipped`.
 */
export interface SeedOpenRouterPromptsResult {
  /**
   * Definitions looked at, after filtering.
   */
  readonly considered: number;
  /**
   * Prompt documents created. Always `<= versionsPublished`, since creating one always publishes its
   * declared version too.
   */
  readonly promptsCreated: number;
  /**
   * Versions written at their declared number.
   */
  readonly versionsPublished: number;
  /**
   * Definitions whose declared number the store already carried — the steady state, so a scheduled
   * reseed reports every definition here once it has converged.
   */
  readonly upToDate: number;
  /**
   * The only drift alarm: a definition the seed refused to write. Either the store advanced past it,
   * something else already wrote the number it declares, or the prompt is ARCHIVED. Recovery is to bump
   * the definition's version, which works precisely because the seed pins rather than allocates.
   */
  readonly skipped: number;
  /**
   * Config warnings raised while validating the definitions, each prefixed with its prompt key.
   */
  readonly warnings: string[];
}

/**
 * Server actions for managing prompts.
 *
 * These exist instead of an Angular UI: they reach the model API, and the existing callModel MCP
 * surface makes them callable without building a screen for it.
 *
 * The one read is {@link readOpenRouterPrompt}, which answers "what does this prompt serve right now".
 * Fetching either document by key is already covered by model-get, and listing by the model API's
 * standard query over {@link openRouterPromptsWithStateQuery}, so the read earns its place only by
 * resolving — following the version pointer and the code-definition fallback that model-get cannot.
 */
export abstract class OpenRouterPromptServerActions {
  abstract readOpenRouterPrompt(params: ReadOpenRouterPromptParams): Promise<(document: OpenRouterPromptDocument) => Promise<ReadOpenRouterPromptResult>>;
  abstract createOpenRouterPrompt(params: CreateOpenRouterPromptParams): Promise<OpenRouterPromptDocument>;
  abstract createOpenRouterTemplate(params: CreateOpenRouterTemplateParams): Promise<() => Promise<OnCallCreateModelResult>>;
  abstract previewOpenRouterTemplate(params: PreviewOpenRouterTemplateParams): Promise<(document: OpenRouterPromptDocument) => Promise<PreviewOpenRouterTemplateResult>>;
  abstract updateOpenRouterPrompt(params: UpdateOpenRouterPromptParams): Promise<(document: OpenRouterPromptDocument) => Promise<OpenRouterPromptDocument>>;
  abstract createOpenRouterPromptVersion(params: CreateOpenRouterPromptVersionParams): Promise<(document: OpenRouterPromptDocument, options?: Maybe<OpenRouterPromptVersionWriteOptions>) => Promise<CreateOpenRouterPromptVersionResult>>;
  abstract updateOpenRouterPromptVersion(params: UpdateOpenRouterPromptVersionParams): Promise<(document: OpenRouterPromptVersionDocument, options?: Maybe<OpenRouterPromptVersionWriteOptions>) => Promise<UpdateOpenRouterPromptVersionResult>>;
  /**
   * Uncurried, like {@link createOpenRouterPrompt}: a seed has no target document to curry over — the
   * documents it writes are the ones it is deciding whether to create.
   */
  abstract seedOpenRouterPrompts(params: SeedOpenRouterPromptsParams): Promise<SeedOpenRouterPromptsResult>;
}

/**
 * Creates the {@link OpenRouterPromptServerActions}.
 *
 * @param context - The actions context.
 * @returns The server actions.
 */
export function openRouterPromptServerActions(context: OpenRouterPromptServerActionsContext): OpenRouterPromptServerActions {
  return {
    readOpenRouterPrompt: readOpenRouterPromptFactory(context),
    createOpenRouterPrompt: createOpenRouterPromptFactory(context),
    createOpenRouterTemplate: createOpenRouterTemplateFactory(context),
    previewOpenRouterTemplate: previewOpenRouterTemplateFactory(context),
    updateOpenRouterPrompt: updateOpenRouterPromptFactory(context),
    createOpenRouterPromptVersion: createOpenRouterPromptVersionFactory(context),
    updateOpenRouterPromptVersion: updateOpenRouterPromptVersionFactory(context),
    seedOpenRouterPrompts: seedOpenRouterPromptsFactory(context)
  };
}

/**
 * Creates a new prompt at its caller-supplied key, refusing a key that already exists.
 *
 * Takes its params directly rather than through an arktype-validated action: the only callers are a
 * seed and a test, both of them server-side.
 *
 * @param context - The actions context.
 * @returns The create action.
 */
export function createOpenRouterPromptFactory(context: OpenRouterPromptServerActionsContext) {
  const { openRouterPromptCollection } = context;

  return async (params: CreateOpenRouterPromptParams) => {
    const { key, name, description, tags } = params;

    return openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
      const document = openRouterPromptCollection.documentAccessorForTransaction(transaction).loadDocumentForId(key);
      const exists = await document.accessor.exists();

      if (exists) {
        throw new Error(`An OpenRouterPrompt with the key "${key}" already exists.`);
      }

      await document.accessor.set({
        cat: new Date(),
        n: name,
        d: description,
        s: OpenRouterPromptState.DRAFT,
        lv: 0,
        t: tags
      });

      return openRouterPromptCollection.documentAccessor().loadDocumentForId(key);
    });
  };
}

/**
 * Creates a message template: a prompt of a registered template type, created as a DRAFT with no version.
 *
 * Refuses an unregistered type, and a key that is taken by a code template, a code prompt definition or an existing prompt.
 *
 * @param context - The actions context.
 * @returns The create template action.
 */
export function createOpenRouterTemplateFactory(context: OpenRouterPromptServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, openRouterPromptCollection, openRouterPromptService } = context;

  return firebaseServerActionTransformFunctionFactory(createOpenRouterTemplateParamsType, async (params) => {
    const { key, name, description, tags, templateType } = params;

    return async (): Promise<OnCallCreateModelResult> => {
      const templateService = requireOpenRouterTemplateService(context);

      if (!OPENROUTER_TEMPLATE_KEY_REGEX.test(key)) {
        throw badRequestError({ message: `The template key "${key}" may only hold letters, numbers, dashes and underscores.` });
      }

      if (templateService.typeConfigService.registeredConfigForTemplateType(templateType) == null) {
        throw badRequestError({ message: `No template type is registered for "${templateType}".` });
      }

      const definitions = await openRouterPromptService.loadPromptDefinitions();

      if (templateService.codeTemplate(key) != null || definitions.some((x) => x.promptKey === key)) {
        throw preconditionConflictError({ message: `The key "${key}" belongs to a template or prompt defined in code.` });
      }

      const document = await openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
        const inTransaction = openRouterPromptCollection.documentAccessorForTransaction(transaction).loadDocumentForId(key);
        const exists = await inTransaction.accessor.exists();

        if (exists) {
          throw preconditionConflictError({ message: `An OpenRouterPrompt with the key "${key}" already exists.` });
        }

        await inTransaction.accessor.set({ cat: new Date(), n: name, d: description, s: OpenRouterPromptState.DRAFT, lv: 0, t: tags, tt: templateType });
        return inTransaction;
      });

      openRouterPromptService.clearCachedPrompt(key);
      return { modelKeys: [document.key] };
    };
  });
}

/**
 * Previews a template, or a draft of one, through the real render path. Problems are reported in the result, not thrown.
 *
 * @param context - The actions context.
 * @returns The preview action.
 */
export function previewOpenRouterTemplateFactory(context: OpenRouterPromptServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(previewOpenRouterTemplateParamsType, async (params) => {
    const { version, draft, data, notification, accessorData, modelOutput, review, callModel } = params;

    return async (document: OpenRouterPromptDocument): Promise<PreviewOpenRouterTemplateResult> => {
      const templateService = requireOpenRouterTemplateService(context);
      const draftContent: Maybe<OpenRouterTemplateVersionContent> =
        draft == null
          ? undefined
          : {
              script: draft.script,
              finalScript: draft.finalScript,
              instructions: draft.instructions,
              messages: draft.messages === undefined ? undefined : openRouterSeedMessagesForParams(draft.messages),
              config: draft.config as Maybe<OpenRouterModelConfig>
            };

      return templateService.previewTemplate({
        templateKey: document.id,
        version,
        draft: draftContent,
        data: data ?? undefined,
        notification,
        accessorData,
        modelOutput: modelOutput == null ? undefined : { text: modelOutput.text ?? '', json: modelOutput.json },
        review,
        callModel
      });
    };
  });
}

/**
 * Updates a prompt's metadata, lifecycle state, or active version, or kills template versions, then drops its cached
 * resolution.
 *
 * @param context - The actions context.
 * @returns The update action.
 */
export function updateOpenRouterPromptFactory(context: OpenRouterPromptServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, openRouterPromptCollection, openRouterPromptVersionCollectionFactory, openRouterPromptService } = context;

  return firebaseServerActionTransformFunctionFactory(updateOpenRouterPromptParamsType, async (params) => {
    const { name, description, tags, state, activeVersion, storeLocked, killVersions } = params;

    return async (document: OpenRouterPromptDocument) => {
      await openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
        const inTransaction = openRouterPromptCollection.documentAccessorForTransaction(transaction).loadDocument(document.documentRef);
        const prompt = await inTransaction.snapshotData();

        if (prompt == null) {
          throw new Error(`The OpenRouterPrompt "${document.id}" does not exist.`);
        }

        if (killVersions?.length && prompt.tt == null) {
          throw badRequestError({ message: `OpenRouterPrompt "${document.id}" is not a template, so its versions can't be killed.` });
        }

        if (activeVersion != null && killVersions?.includes(activeVersion)) {
          throw badRequestError({ message: `Cannot both kill version ${activeVersion} of OpenRouter template "${document.id}" and make it active.` });
        }

        // The versions this write kills: the ones named, plus every older version when the server kills them on activate.
        const killPreviousVersions = prompt.tt != null && activeVersion != null && context.openRouterTemplateService?.killPreviousVersionsOnActivate === true;
        const killVersionNumbers = unique([...(killVersions ?? []), ...(killPreviousVersions ? range(1, activeVersion) : [])]);
        const versionAccessor = openRouterPromptVersionCollectionFactory(inTransaction).documentAccessorForTransaction(transaction);
        const activeVersionDocument = activeVersion == null ? undefined : versionAccessor.loadDocumentForId(openRouterPromptVersionId(activeVersion));
        const killVersionDocuments = killVersionNumbers.map((x) => versionAccessor.loadDocumentForId(openRouterPromptVersionId(x)));
        const [activeVersionData, killVersionData] = await Promise.all([activeVersionDocument?.snapshotData(), Promise.all(killVersionDocuments.map((x) => x.snapshotData()))]);

        if (activeVersion != null) {
          // Promoting to a version that was never published would leave every unpinned caller failing to
          // resolve, so the pointer is only allowed to move to a version that exists.
          if (activeVersionData == null) {
            throw new Error(`Cannot set activeVersion to ${activeVersion} on OpenRouterPrompt "${document.id}": that version does not exist.`);
          }

          if (prompt.tt != null) {
            if (activeVersionData.kat != null) {
              throw preconditionConflictError({ message: `Cannot set activeVersion to ${activeVersion} on OpenRouter template "${document.id}": that version was killed.` });
            }

            // A template version that carries code is only ever served once approved, so promoting one that is unapproved,
            // or was edited after its approval, is refused here rather than failing every render after it.
            const resolved = openRouterResolvedPromptForVersion(document.id, activeVersionData, prompt.tt);

            if (openRouterTemplateVersionHasCode(openRouterTemplateVersionContentForResolvedPrompt(resolved)) && !requireOpenRouterTemplateService(context).verifyTemplateVersionApproval(resolved)) {
              throw preconditionConflictError({ message: `Cannot set activeVersion to ${activeVersion} on OpenRouter template "${document.id}": that version is not approved, or was changed after it was approved.` });
            }
          }
        }

        // An older version missing from the store is skipped, but one the caller named has to exist.
        const missingKillVersions = killVersionNumbers.filter((x, i) => killVersionData[i] == null && killVersions?.includes(x));

        if (missingKillVersions.length) {
          throw badRequestError({ message: `Cannot kill version(s) ${missingKillVersions.join(', ')} of OpenRouter template "${document.id}": they do not exist.` });
        }

        const now = new Date();

        // A version already killed keeps its first kill date.
        await Promise.all(
          killVersionDocuments
            .filter((_, i) => {
              const data = killVersionData[i];
              return data != null && data.kat == null;
            })
            .map((x) => x.update({ kat: now }))
        );

        await inTransaction.update({ n: name ?? undefined, d: description, t: tags, s: state ?? undefined, av: activeVersion, sl: storeLocked, uat: now });
      });

      openRouterPromptService.clearCachedPrompt(document.id);
      return document;
    };
  });
}

/**
 * Reads a prompt together with the version it actually serves.
 *
 * Goes through the prompt SERVICE rather than reading the two documents directly, so the answer is the
 * one a dispatch would get — code definition included. Reading the documents here would reimplement the
 * precedence rule in a second place, where it could drift from the resolver it is meant to describe.
 *
 * @param context - The actions context.
 * @returns The read action.
 */
export function readOpenRouterPromptFactory(context: OpenRouterPromptServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, openRouterPromptService } = context;

  return firebaseServerActionTransformFunctionFactory(readOpenRouterPromptParamsType, async (params) => {
    const { version } = params;

    return async (document: OpenRouterPromptDocument) => {
      const promptKey = document.id;

      // Both halves come from the service: `loadPrompt` reads the store and returns null for a prompt
      // that exists only in code, while `readPrompt` always answers with something servable or throws.
      const [prompt, resolution] = await Promise.all([openRouterPromptService.loadPrompt(promptKey), openRouterPromptService.readPrompt({ promptKey, version })]);
      const { resolved, source } = resolution;
      let validation: { readonly warnings: string[]; readonly errors: string[] };

      if (resolved.template == null) {
        validation = validateOpenRouterModelConfig(resolved.config, { decision: resolved.questions != null });
      } else {
        // A template is judged per its type's mode: a DETERMINISTIC version has no model config, and reporting "no model"
        // for it would be wrong.
        const typeConfig = context.openRouterTemplateService?.typeConfigService.registeredConfigForTemplateType(resolved.template.type);
        const shape = typeConfig == null ? { warnings: [], errors: [`Template type "${resolved.template.type}" is not registered on this server, so the template can't be validated or rendered.`] } : checkOpenRouterTemplateVersionShape(typeConfig, openRouterTemplateVersionContentForResolvedPrompt(resolved));
        validation = resolved.template.killedAt == null ? shape : { warnings: shape.warnings, errors: [`Version ${resolved.version} was killed, so it is never rendered.`, ...shape.errors] };
      }

      const result: ReadOpenRouterPromptResult = {
        prompt: prompt ?? null,
        resolved,
        source,
        // Both severities are reported rather than thrown. A create refuses an invalid config, but the
        // resolver only refuses one when configured to, so an unusable config can already be live —
        // and showing it is what the read is for.
        warnings: validation.warnings,
        errors: validation.errors
      };

      return result;
    };
  });
}

/**
 * Creates a new version, allocating its number inside the transaction, locking the version it succeeds,
 * and optionally promoting it. Promoting a template version also kills every older version when the template service's
 * `killPreviousVersionsOnActivate` is on.
 *
 * @param context - The actions context.
 * @returns The create version action.
 */
export function createOpenRouterPromptVersionFactory(context: OpenRouterPromptServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, openRouterPromptCollection, openRouterPromptVersionCollectionFactory, openRouterPromptService } = context;

  return firebaseServerActionTransformFunctionFactory(createOpenRouterPromptVersionParamsType, async (params) => {
    const { instructions, messages, config, questions, script, finalScript, notes, activate } = params;

    return async (document: OpenRouterPromptDocument, options?: Maybe<OpenRouterPromptVersionWriteOptions>): Promise<CreateOpenRouterPromptVersionResult> => {
      const modelConfig = (config ?? undefined) as Maybe<OpenRouterModelConfig>;
      const modelQuestions = (questions ?? undefined) as Maybe<OpenRouterDecisionQuestions>;
      const templateType: Maybe<OpenRouterTemplateTypeKey> = (await document.snapshotData())?.tt;
      let validation: { readonly valid: boolean; readonly warnings: string[]; readonly errors: string[] };
      let templateContent: Maybe<OpenRouterTemplateVersionContent>;
      let review: Maybe<OpenRouterTemplateReviewRecord>;

      if (templateType != null) {
        // Every check runs BEFORE the transaction, and any failure refuses the write: a template version only exists once
        // it has passed, which is what makes `activate: true` safe.
        const templateService = requireOpenRouterTemplateService(context);
        const typeConfig = templateService.typeConfigService.configForTemplateType(templateType);
        templateContent = { script, finalScript, instructions, messages: openRouterSeedMessagesForParams(messages), config: modelConfig, questions: modelQuestions };
        const checked = await templateService.validateTemplateVersion({ typeConfig, content: templateContent, review: openRouterTemplateVersionHasCode(templateContent) });

        if (!checked.valid) {
          throw openRouterTemplateCheckFailedError(`Cannot create a version of OpenRouter template "${document.id}"`, checked);
        }

        validation = { valid: true, warnings: checked.warnings, errors: [] };
        review = checked.review;
      } else if (script != null || finalScript != null) {
        throw badRequestError({ message: `OpenRouterPrompt "${document.id}" is not a template, so its versions take no script.` });
      } else {
        validation = validateOpenRouterModelConfig(modelConfig ?? {}, { decision: modelQuestions != null });
      }

      if (!validation.valid) {
        throw new Error(`Cannot create a version of OpenRouterPrompt "${document.id}": ${validation.errors.join(' ')}`);
      }

      if (modelQuestions != null && templateType == null) {
        const questionValidation = validateOpenRouterDecisionQuestions(modelQuestions);

        if (!questionValidation.valid) {
          throw new Error(`Cannot create a version of OpenRouterPrompt "${document.id}": ${questionValidation.errors.join(' ')}`);
        }
      }

      const result = await openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
        const inTransaction = openRouterPromptCollection.documentAccessorForTransaction(transaction).loadDocument(document.documentRef);
        const prompt = await inTransaction.snapshotData();

        if (prompt == null) {
          throw new Error(`The OpenRouterPrompt "${document.id}" does not exist.`);
        }

        // Allocated from the prompt document inside the transaction rather than supplied by the caller:
        // two concurrent creates picking the same number would silently overwrite one another.
        const version = prompt.lv + 1;
        const versionCollection = openRouterPromptVersionCollectionFactory(inTransaction).documentAccessorForTransaction(transaction);
        const versionDocument = versionCollection.loadDocumentForId(openRouterPromptVersionId(version));

        // The outgoing version stops being editable the moment it stops being the head — in the same
        // transaction, so there is no window in which two versions are both unlocked. Read first:
        // Firestore forbids a read after a write in a transaction, and a `set` on a version that was
        // deleted out from under us would resurrect it as a document holding nothing but a lock.
        const previousVersionDocument = prompt.lv > 0 ? versionCollection.loadDocumentForId(openRouterPromptVersionId(prompt.lv)) : undefined;

        // When the server kills older versions on activate, every version below this one is read here too, before any write.
        const killPreviousVersions = activate === true && templateType != null && context.openRouterTemplateService?.killPreviousVersionsOnActivate === true;
        const killVersionDocuments = (killPreviousVersions ? range(1, version) : []).map((x) => versionCollection.loadDocumentForId(openRouterPromptVersionId(x)));
        const [previousVersionExists, killVersionData] = await Promise.all([previousVersionDocument == null ? false : previousVersionDocument.accessor.exists(), Promise.all(killVersionDocuments.map((x) => x.snapshotData()))]);

        if (prompt.tt != templateType) {
          throw new Error(`The template type of OpenRouterPrompt "${document.id}" changed while its version was being checked.`);
        }

        // Signed inside the transaction, once the version number it covers is allocated.
        const approval = templateType != null && templateContent != null && openRouterTemplateVersionHasCode(templateContent) ? requireOpenRouterTemplateService(context).approveTemplateVersion({ promptKey: document.id, version, templateType, ...templateContent }) : undefined;

        const versionData: OpenRouterPromptVersion = {
          cat: new Date(),
          v: version,
          i: instructions,
          m: messages?.map(({ role, content }) => ({ r: role, c: content })),
          c: modelConfig,
          q: modelQuestions,
          nt: notes,
          by: options?.createdBy,
          sc: script,
          fsc: finalScript,
          rv: review,
          ah: approval?.approvalHash,
          aat: approval?.approvedAt
        };

        if (previousVersionDocument != null && previousVersionExists) {
          await previousVersionDocument.update({ lk: true });
        }

        // A version already killed keeps its first kill date.
        await Promise.all(
          killVersionDocuments
            .filter((_, i) => {
              const data = killVersionData[i];
              return data != null && data.kat == null;
            })
            .map((x) => x.update({ kat: versionData.cat }))
        );

        await versionDocument.accessor.set(versionData);
        await inTransaction.update({ lv: version, uat: new Date(), ...(activate ? { av: version, s: OpenRouterPromptState.ACTIVE } : undefined) });

        // The version document's own path, not the prompt's: a create reports what it created.
        return { modelKeys: [versionDocument.documentRef.path] as [FirestoreModelKey], version, activated: activate === true, warnings: validation.warnings, review };
      });

      openRouterPromptService.clearCachedPrompt(document.id);
      return result;
    };
  });
}

/**
 * Edits the latest version of a prompt in place, refusing one the next version has locked.
 *
 * The lock is re-read inside the transaction rather than trusted from the caller's snapshot: a create
 * racing this edit would otherwise let the write land on a version that had just stopped being the head.
 *
 * @param context - The actions context.
 * @returns The update version action.
 */
export function updateOpenRouterPromptVersionFactory(context: OpenRouterPromptServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, openRouterPromptCollection, openRouterPromptVersionCollectionGroup, openRouterPromptService } = context;

  return firebaseServerActionTransformFunctionFactory(updateOpenRouterPromptVersionParamsType, async (params) => {
    const { instructions, messages, config, questions, script, finalScript, notes } = params;

    return async (document: OpenRouterPromptVersionDocument, options?: Maybe<OpenRouterPromptVersionWriteOptions>): Promise<UpdateOpenRouterPromptVersionResult> => {
      const inputConfig = config as Maybe<OpenRouterModelConfig>;
      const inputQuestions = questions as Maybe<OpenRouterDecisionQuestions>;
      const promptKey = firestoreModelId(firestoreModelKeyParentKey(document) as FirestoreModelKey);
      const templateType: Maybe<OpenRouterTemplateTypeKey> = (await openRouterPromptCollection.documentAccessor().loadDocumentForId(promptKey).snapshotData())?.tt;
      let templateCheck: Maybe<{ readonly payload: string; readonly content: OpenRouterTemplateVersionContent; readonly warnings: string[]; readonly review: Maybe<OpenRouterTemplateReviewRecord> }>;

      if (templateType != null) {
        // Judged against what the version will SAY once written, before the transaction: the review is a model call.
        const templateService = requireOpenRouterTemplateService(context);
        const typeConfig = templateService.typeConfigService.configForTemplateType(templateType);
        const current = await document.snapshotData();

        if (current == null) {
          throw new Error(`The OpenRouterPromptVersion "${document.key}" does not exist.`);
        }

        // Checked before the review, which is a model call. The transaction checks again.
        if (current.kat != null) {
          throw openRouterPromptVersionKilledError(document);
        }

        const content = openRouterTemplateVersionContentForUpdate(current, params);
        const checked = await templateService.validateTemplateVersion({ typeConfig, content, review: openRouterTemplateVersionHasCode(content) });

        if (!checked.valid) {
          throw openRouterTemplateCheckFailedError(`Cannot update OpenRouter template version "${document.key}"`, checked);
        }

        templateCheck = { payload: openRouterTemplateApprovalPayload({ promptKey, version: current.v, templateType, ...content }), content, warnings: checked.warnings, review: checked.review };
      } else if (script != null || finalScript != null) {
        throw badRequestError({ message: `OpenRouterPrompt "${promptKey}" is not a template, so its versions take no script.` });
      }

      const validation = await openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
        const inTransaction = openRouterPromptVersionCollectionGroup.documentAccessorForTransaction(transaction).loadDocument(document.documentRef);
        const version = await inTransaction.snapshotData();

        if (version == null) {
          throw new Error(`The OpenRouterPromptVersion "${document.key}" does not exist.`);
        }

        // Editing a killed version would sign it again, bringing it back.
        if (version.kat != null) {
          throw openRouterPromptVersionKilledError(document);
        }

        if (version.lk) {
          throw new Error(`The OpenRouterPromptVersion "${document.key}" is locked, because a newer version exists. Create a new version instead.`);
        }

        if (templateType != null && templateCheck != null) {
          // What was checked must be what is written: a concurrent edit between the check and here is refused.
          const content = openRouterTemplateVersionContentForUpdate(version, params);

          if (openRouterTemplateApprovalPayload({ promptKey, version: version.v, templateType, ...content }) !== templateCheck.payload) {
            throw new Error(`The OpenRouterPromptVersion "${document.key}" changed while it was being checked. Try again.`);
          }

          const approval = openRouterTemplateVersionHasCode(content) ? requireOpenRouterTemplateService(context).approveTemplateVersion({ promptKey, version: version.v, templateType, ...content }) : undefined;

          await inTransaction.update({
            i: instructions,
            m: messages == null ? messages : messages.map(({ role, content }) => ({ r: role, c: content })),
            c: inputConfig,
            q: inputQuestions,
            nt: notes,
            sc: script,
            fsc: finalScript,
            rv: templateCheck.review ?? null,
            ah: approval?.approvalHash ?? null,
            aat: approval?.approvedAt ?? null,
            by: options?.createdBy ?? undefined
          });

          return { valid: true, warnings: templateCheck.warnings, errors: [] };
        }

        // Validated against what the version will SAY once written, not against the patch: an edit that
        // touches only the instructions must not be judged against an empty config and refused for
        // naming no model. An explicitly null config is judged as the empty config it would leave behind,
        // which is exactly the refusal that should happen.
        // The same "judge what it will SAY" rule applied to the questions: an omitted `questions` leaves
        // the version's own, so an edit touching only the instructions is still judged as the decision
        // it remains rather than as a completion that names a System One model.
        const nextQuestions = questions === undefined ? version.q : inputQuestions;
        const result = validateOpenRouterModelConfig((config === undefined ? version.c : inputConfig) ?? {}, { decision: nextQuestions != null });

        if (!result.valid) {
          throw new Error(`Cannot update OpenRouterPromptVersion "${document.key}": ${result.errors.join(' ')}`);
        }

        if (nextQuestions != null) {
          const questionValidation = validateOpenRouterDecisionQuestions(nextQuestions);

          if (!questionValidation.valid) {
            throw new Error(`Cannot update OpenRouterPromptVersion "${document.key}": ${questionValidation.errors.join(' ')}`);
          }
        }

        // Undefined fields are stripped before the write, so an omitted field is left as it was. `null`
        // is passed through for the fields that can meaningfully carry nothing.
        await inTransaction.update({ i: instructions, m: messages == null ? messages : messages.map(({ role, content }) => ({ r: role, c: content })), c: inputConfig, q: inputQuestions, nt: notes });
        return result;
      });

      // Keyed by the parent prompt, which is the id the cache and the resolver both work in.
      openRouterPromptService.clearCachedPrompt(firestoreModelId(firestoreModelKeyParentKey(document) as FirestoreModelKey));
      return { warnings: validation.warnings, review: templateCheck?.review };
    };
  });
}

/**
 * What one definition's seed did.
 */
type SeedOpenRouterPromptOutcome = 'created' | 'published' | 'upToDate' | 'skipped';

/**
 * How many definitions {@link seedOpenRouterPromptsFactory} publishes at a time.
 *
 * Each definition's writes are their own commit against documents no other definition touches, so the
 * bound is not a correctness requirement — it keeps a large registry from opening one connection per
 * prompt against Firestore all at once.
 */
export const OPENROUTER_SEED_PROMPTS_MAX_PARALLEL_UPDATES = 25;

/**
 * One definition, the prompt document it seeds, and that document's state as of the run's opening read.
 *
 * The prompt is read once for the whole run rather than once per definition, so the parallel phase
 * starts from data it does not have to fetch again.
 */
interface SeedOpenRouterPromptTarget {
  /**
   * The definition being published.
   */
  readonly definition: OpenRouterPromptDefinition;
  /**
   * The prompt document addressed by the definition's key.
   */
  readonly promptDocument: OpenRouterPromptDocument;
  /**
   * The prompt as it stood at the opening read, or undefined when the key has no document yet.
   */
  readonly prompt: Maybe<OpenRouterPrompt>;
}

/**
 * Publishes each code definition the prompt service carries at ITS OWN declared version number.
 *
 * The number is a compile-time constant rather than one allocated from `lv`, which is the whole point:
 * an auto-allocating writer cannot converge on a number chosen in code, because its write address moves
 * with its own effect — so a store seeded by {@link createOpenRouterPromptVersionFactory} sits
 * permanently behind the definition and the resolver stands in for it forever. Pinning makes the write
 * address a pure function of the definition, so a re-seed is a no-op rather than a step toward
 * convergence, and a scheduled reseed can keep the store in step with deploys.
 *
 * Publishing is gated on `lv` rather than `av`: `lv` is the allocator and is monotone, while `av` is a
 * pointer an operator can move backwards — gating on it would let a demotion re-trigger a publish on
 * every scheduled tick, forever.
 *
 * Deliberately NOT built on {@link createOpenRouterPromptVersionFactory}: that action is reachable over
 * callModel/MCP, and its in-transaction allocation is a race-safety contract on a public surface rather
 * than an implementation detail. A seed needs no allocator at all, because the number it writes is a
 * compile-time constant — something `CreateOpenRouterPromptVersionParams` cannot assert about an
 * arbitrary caller.
 *
 * No transaction, at any scope. A version document carries a whole prompt's text, so a registry of them
 * can put megabytes through a single commit, and a commit — transaction or write batch alike — is capped
 * around 10MB. The run is instead one read pass over every prompt document, then each definition
 * published independently through its OWN write batch, at most
 * {@link OPENROUTER_SEED_PROMPTS_MAX_PARALLEL_UPDATES} at a time. The batch is what keeps a publish
 * atomic — the version, the lock on the head it replaces, and the pointer move land together or not at
 * all — while holding any one commit to the three documents a single definition touches.
 *
 * What that costs is the transaction's read set: the check that nothing else already holds the number
 * being written is now a read taken shortly before the commit rather than a conflict detected at it.
 * Losing that window means a seed overwrites a version an operator published under the same number in
 * the same instant — narrow enough to trade for a run whose size cannot refuse it.
 *
 * @param context - The actions context.
 * @returns The seed action.
 */
export function seedOpenRouterPromptsFactory(context: OpenRouterPromptServerActionsContext) {
  const { openRouterPromptCollection, openRouterPromptVersionCollectionFactory, openRouterPromptService } = context;

  return async (params: SeedOpenRouterPromptsParams): Promise<SeedOpenRouterPromptsResult> => {
    const { promptKeys } = params;
    const keyFilter = promptKeys == null ? undefined : new Set(promptKeys);
    const definitions = (await openRouterPromptService.loadPromptDefinitions()).filter((x) => keyFilter == null || keyFilter.has(x.promptKey));
    const warnings: string[] = [];

    // Every definition is validated before anything is written: half-seeding a registry because entry
    // three is broken leaves a state no rerun explains.
    definitions.forEach((definition) => {
      const { promptKey, version, config } = definition;

      if (!Number.isInteger(version) || version < 1) {
        throw new Error(`Cannot seed OpenRouterPrompt "${promptKey}": the definition declares version ${version}, which is not an integer >= 1.`);
      }

      const decision = definition.questions != null;
      const validation = validateOpenRouterModelConfig(config, { decision });

      if (!validation.valid) {
        throw new Error(`Cannot seed OpenRouterPrompt "${promptKey}": ${validation.errors.join(' ')}`);
      }

      validation.warnings.forEach((warning) => warnings.push(`${promptKey}: ${warning}`));

      if (decision) {
        // A malformed question map is refused HERE rather than at the wire. The limits it enforces are
        // quiet ones — an eleven-level Score looks entirely reasonable and is rejected by the route — so
        // a seed that published one would produce a prompt that resolves, validates, and then fails
        // every time it is asked.
        const questionValidation = validateOpenRouterDecisionQuestions(definition.questions);

        if (!questionValidation.valid) {
          throw new Error(`Cannot seed OpenRouterPrompt "${promptKey}": ${questionValidation.errors.join(' ')}`);
        }
      }
    });

    /**
     * Publishes one definition, starting from the prompt the opening read already produced.
     *
     * @param target - The definition and the prompt document it seeds.
     * @returns What the write did.
     */
    async function seedTarget(target: SeedOpenRouterPromptTarget): Promise<SeedOpenRouterPromptOutcome> {
      const { definition, promptDocument, prompt } = target;
      const { promptKey, version } = definition;

      const latestVersion = prompt?.lv ?? 0;
      // An ARCHIVED prompt is never resurrected: retirement is a deliberate act, and a scheduled
      // reseed silently undoing it is the same class of bug as reverting an operator's rename. Decided
      // from the prompt alone, so an archived definition costs no further read.
      const archived = prompt?.s === OpenRouterPromptState.ARCHIVED;
      // A STORE-LOCKED prompt is the same rule pointed at a different writer: its content is maintained
      // at runtime, so code publishing over it would silently discard an operator's work. Reported as a
      // warning rather than skipped in silence, because a definition whose version has moved ahead and
      // never lands otherwise looks exactly like a seed that ran and did nothing.
      const storeLocked = prompt?.sl === true;

      let outcome: SeedOpenRouterPromptOutcome;

      if (archived) {
        outcome = 'skipped';
      } else if (storeLocked) {
        warnings.push(`${promptKey}: the prompt is store-locked, so the definition declaring version ${version} was not published. Unset \`storeLocked\` to let code seed it again.`);
        outcome = 'skipped';
      } else {
        const versionCollection = openRouterPromptVersionCollectionFactory(promptDocument);
        const versionAccessor = versionCollection.documentAccessor();
        const targetVersionId = openRouterPromptVersionId(version);
        // Existence rather than data: nothing here reads what a version at that number SAYS, only
        // whether the number is already taken.
        const targetVersionExists = await versionAccessor.loadDocumentForId(targetVersionId).accessor.exists();

        if (version > latestVersion && !targetVersionExists) {
          // The outgoing head's address comes from the prompt's own `lv`, and `version > latestVersion`
          // above is what guarantees it is not the document about to be written. Existence-checked
          // because a batched `update` on a missing document fails the whole commit, and a `set` on a
          // deleted version would resurrect it holding nothing but a lock.
          const previousVersionId = latestVersion > 0 ? openRouterPromptVersionId(latestVersion) : undefined;
          const previousVersionExists = previousVersionId == null ? false : await versionAccessor.loadDocumentForId(previousVersionId).accessor.exists();

          const versionData: OpenRouterPromptVersion = {
            cat: new Date(),
            v: version,
            i: definition.instructions,
            m: definition.messages?.map(({ role, content }) => ({ r: role, c: content })),
            c: definition.config,
            q: definition.questions,
            nt: `Seeded from the code definition declaring version ${version}.`
          };

          // One batch for this definition and nothing else. Atomic, so a prompt never ends up pointing
          // at a version the run failed to write, and bounded, so the commit carries one prompt's text
          // rather than the registry's.
          const writeBatch = openRouterPromptCollection.firestoreContext.batch();
          const versionWriteAccessor = versionCollection.documentAccessorForWriteBatch(writeBatch);
          const promptWriteDocument = openRouterPromptCollection.documentAccessorForWriteBatch(writeBatch).loadDocumentForId(promptKey);

          if (previousVersionId != null && previousVersionExists) {
            await versionWriteAccessor.loadDocumentForId(previousVersionId).update({ lk: true });
          }

          await versionWriteAccessor.loadDocumentForId(targetVersionId).accessor.set(versionData);

          if (prompt == null) {
            // `storeLocked` is written ONLY here, on create. A definition cannot lock a prompt it did
            // not create: doing so would let code seize one an operator is already maintaining, which
            // is the exact thing the flag exists to prevent in the other direction.
            await promptWriteDocument.accessor.set({ cat: new Date(), n: definition.name, d: definition.description, s: OpenRouterPromptState.ACTIVE, lv: version, av: version, sl: definition.storeLocked });
          } else {
            // `n`/`d`/`t` are deliberately untouched: they are operator-editable through
            // updateOpenRouterPrompt, and a scheduled reseed reverting a rename is a silent regression.
            await promptWriteDocument.update({ lv: version, av: version, s: OpenRouterPromptState.ACTIVE, uat: new Date() });
          }

          await writeBatch.commit();

          // Only the prompts that actually changed, and only once the commit landed. Missing this
          // leaves a scheduled reseed invisible for the whole OPENROUTER_PROMPT_CACHE_DURATION window.
          openRouterPromptService.clearCachedPrompt(promptKey);
          outcome = prompt == null ? 'created' : 'published';
        } else {
          // The only way to land on `upToDate` is a prompt whose `lv` already covers the declared
          // number AND whose document at that number is present — anything else is drift the seed
          // refuses to paper over by overwriting a number someone else wrote.
          outcome = version > latestVersion || !targetVersionExists ? 'skipped' : 'upToDate';
        }
      }

      return outcome;
    }

    // Every prompt document up front, in one pass, before a single write: the addresses are the keys the
    // definitions declare, so they all resolve together, and reading them here is what lets the write
    // phase decide each definition without a transaction to re-read them in.
    const promptDocumentAccessor = openRouterPromptCollection.documentAccessor();
    const promptTuples = await getDocumentSnapshotDataTuples(definitions.map((x) => promptDocumentAccessor.loadDocumentForId(x.promptKey)));
    const targets: SeedOpenRouterPromptTarget[] = definitions.map((definition, i) => ({ definition, promptDocument: promptTuples[i][0], prompt: promptTuples[i][1] }));

    // Disjoint by construction — one definition per key, one commit per definition — so the only reason
    // these run bounded rather than all at once is the connection count.
    const outcomes = await runAsyncTasksForValues(targets, seedTarget, { maxParallelTasks: OPENROUTER_SEED_PROMPTS_MAX_PARALLEL_UPDATES });

    let promptsCreated = 0;
    let versionsPublished = 0;
    let upToDate = 0;
    let skipped = 0;

    outcomes.forEach((outcome) => {
      switch (outcome) {
        case 'created':
          promptsCreated += 1;
          versionsPublished += 1;
          break;
        case 'published':
          versionsPublished += 1;
          break;
        case 'upToDate':
          upToDate += 1;
          break;
        case 'skipped':
          skipped += 1;
          break;
      }
    });

    return { considered: definitions.length, promptsCreated, versionsPublished, upToDate, skipped, warnings };
  };
}
