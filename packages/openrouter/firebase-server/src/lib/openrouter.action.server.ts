import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type FirestoreContextReference, type FirestoreModelKey, firestoreModelId, firestoreModelKeyParentKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterModelConfig, type OpenRouterPromptKey, validateOpenRouterModelConfig } from '@dereekb/openrouter';
import {
  type CreateOpenRouterPromptVersionParams,
  type CreateOpenRouterPromptVersionResult,
  type OpenRouterPromptDocument,
  type OpenRouterPromptFirestoreCollections,
  OpenRouterPromptState,
  type OpenRouterPromptVersion,
  type OpenRouterPromptVersionDocument,
  type UpdateOpenRouterPromptParams,
  type UpdateOpenRouterPromptVersionParams,
  type UpdateOpenRouterPromptVersionResult,
  createOpenRouterPromptVersionParamsType,
  openRouterPromptVersionId,
  updateOpenRouterPromptParamsType,
  updateOpenRouterPromptVersionParamsType
} from '@dereekb/openrouter/firebase';
import { type OpenRouterPromptService } from './openrouter.prompt.service';

/**
 * Context required by the OpenRouter prompt server actions.
 */
export interface OpenRouterPromptServerActionsContext extends FirebaseServerActionsContext, OpenRouterPromptFirestoreCollections, FirestoreContextReference {
  /**
   * The prompt service, so a publish or promote can drop its cached resolution immediately instead of
   * leaving the change invisible for the cache window.
   */
  readonly openRouterPromptService: OpenRouterPromptService;
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
 * Server actions for managing prompts.
 *
 * The writes exist instead of an Angular UI: they reach the model API, and the existing callModel MCP
 * surface makes them callable without building a screen for it. Reads are absent because the prompt and
 * version model services already make both fetchable by key through model-get, and listing is the
 * model API's standard query operation over {@link openRouterPromptsWithStateQuery}.
 */
export abstract class OpenRouterPromptServerActions {
  abstract createOpenRouterPrompt(params: CreateOpenRouterPromptParams): Promise<OpenRouterPromptDocument>;
  abstract updateOpenRouterPrompt(params: UpdateOpenRouterPromptParams): Promise<(document: OpenRouterPromptDocument) => Promise<OpenRouterPromptDocument>>;
  abstract createOpenRouterPromptVersion(params: CreateOpenRouterPromptVersionParams): Promise<(document: OpenRouterPromptDocument) => Promise<CreateOpenRouterPromptVersionResult>>;
  abstract updateOpenRouterPromptVersion(params: UpdateOpenRouterPromptVersionParams): Promise<(document: OpenRouterPromptVersionDocument) => Promise<UpdateOpenRouterPromptVersionResult>>;
}

/**
 * Creates the {@link OpenRouterPromptServerActions}.
 *
 * @param context - The actions context.
 * @returns The server actions.
 */
export function openRouterPromptServerActions(context: OpenRouterPromptServerActionsContext): OpenRouterPromptServerActions {
  return {
    createOpenRouterPrompt: createOpenRouterPromptFactory(context),
    updateOpenRouterPrompt: updateOpenRouterPromptFactory(context),
    createOpenRouterPromptVersion: createOpenRouterPromptVersionFactory(context),
    updateOpenRouterPromptVersion: updateOpenRouterPromptVersionFactory(context)
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
 * Updates a prompt's metadata, lifecycle state, or active version, then drops its cached resolution.
 *
 * @param context - The actions context.
 * @returns The update action.
 */
export function updateOpenRouterPromptFactory(context: OpenRouterPromptServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, openRouterPromptCollection, openRouterPromptVersionCollectionFactory, openRouterPromptService } = context;

  return firebaseServerActionTransformFunctionFactory(updateOpenRouterPromptParamsType, async (params) => {
    const { name, description, tags, state, activeVersion } = params;

    return async (document: OpenRouterPromptDocument) => {
      await openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
        const inTransaction = openRouterPromptCollection.documentAccessorForTransaction(transaction).loadDocument(document.documentRef);
        const prompt = await inTransaction.snapshotData();

        if (prompt == null) {
          throw new Error(`The OpenRouterPrompt "${document.id}" does not exist.`);
        }

        if (activeVersion != null) {
          // Promoting to a version that was never published would leave every unpinned caller failing to
          // resolve, so the pointer is only allowed to move to a version that exists.
          const versionDocument = openRouterPromptVersionCollectionFactory(inTransaction).documentAccessorForTransaction(transaction).loadDocumentForId(openRouterPromptVersionId(activeVersion));
          const versionExists = await versionDocument.accessor.exists();

          if (!versionExists) {
            throw new Error(`Cannot set activeVersion to ${activeVersion} on OpenRouterPrompt "${document.id}": that version does not exist.`);
          }
        }

        await inTransaction.update({ n: name ?? undefined, d: description, t: tags, s: state ?? undefined, av: activeVersion, uat: new Date() });
      });

      openRouterPromptService.clearCachedPrompt(document.id);
      return document;
    };
  });
}

/**
 * Creates a new version, allocating its number inside the transaction, locking the version it succeeds,
 * and optionally promoting it.
 *
 * @param context - The actions context.
 * @returns The create version action.
 */
export function createOpenRouterPromptVersionFactory(context: OpenRouterPromptServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, openRouterPromptCollection, openRouterPromptVersionCollectionFactory, openRouterPromptService } = context;

  return firebaseServerActionTransformFunctionFactory(createOpenRouterPromptVersionParamsType, async (params) => {
    const { instructions, messages, config, notes, activate } = params;

    return async (document: OpenRouterPromptDocument): Promise<CreateOpenRouterPromptVersionResult> => {
      const modelConfig = (config ?? undefined) as Maybe<OpenRouterModelConfig>;
      const validation = validateOpenRouterModelConfig(modelConfig ?? {});

      if (!validation.valid) {
        throw new Error(`Cannot create a version of OpenRouterPrompt "${document.id}": ${validation.errors.join(' ')}`);
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
        const previousVersionExists = previousVersionDocument == null ? false : await previousVersionDocument.accessor.exists();

        const versionData: OpenRouterPromptVersion = {
          cat: new Date(),
          v: version,
          i: instructions,
          m: messages?.map(({ role, content }) => ({ r: role, c: content })),
          c: modelConfig,
          nt: notes
        };

        if (previousVersionDocument != null && previousVersionExists) {
          await previousVersionDocument.update({ lk: true });
        }

        await versionDocument.accessor.set(versionData);
        await inTransaction.update({ lv: version, uat: new Date(), ...(activate ? { av: version, s: OpenRouterPromptState.ACTIVE } : undefined) });

        // The version document's own path, not the prompt's: a create reports what it created.
        return { modelKeys: [versionDocument.documentRef.path] as [FirestoreModelKey], version, activated: activate === true, warnings: validation.warnings };
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
    const { instructions, messages, config, notes } = params;

    return async (document: OpenRouterPromptVersionDocument): Promise<UpdateOpenRouterPromptVersionResult> => {
      const inputConfig = config as Maybe<OpenRouterModelConfig>;

      const validation = await openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
        const inTransaction = openRouterPromptVersionCollectionGroup.documentAccessorForTransaction(transaction).loadDocument(document.documentRef);
        const version = await inTransaction.snapshotData();

        if (version == null) {
          throw new Error(`The OpenRouterPromptVersion "${document.key}" does not exist.`);
        }

        if (version.lk) {
          throw new Error(`The OpenRouterPromptVersion "${document.key}" is locked, because a newer version exists. Create a new version instead.`);
        }

        // Validated against what the version will SAY once written, not against the patch: an edit that
        // touches only the instructions must not be judged against an empty config and refused for
        // naming no model. An explicitly null config is judged as the empty config it would leave behind,
        // which is exactly the refusal that should happen.
        const result = validateOpenRouterModelConfig((config === undefined ? version.c : inputConfig) ?? {});

        if (!result.valid) {
          throw new Error(`Cannot update OpenRouterPromptVersion "${document.key}": ${result.errors.join(' ')}`);
        }

        // Undefined fields are stripped before the write, so an omitted field is left as it was. `null`
        // is passed through for the fields that can meaningfully carry nothing.
        await inTransaction.update({ i: instructions, m: messages == null ? messages : messages.map(({ role, content }) => ({ r: role, c: content })), c: inputConfig, nt: notes });
        return result;
      });

      // Keyed by the parent prompt, which is the id the cache and the resolver both work in.
      openRouterPromptService.clearCachedPrompt(firestoreModelId(firestoreModelKeyParentKey(document) as FirestoreModelKey));
      return { warnings: validation.warnings };
    };
  });
}
