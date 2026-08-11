import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type FirestoreContextReference, firestoreModelKey } from '@dereekb/firebase';
import { type Maybe, filterMaybeArrayValues } from '@dereekb/util';
import { type OpenRouterModelConfig, validateOpenRouterModelConfig } from '@dereekb/openrouter';
import {
  type CreateOpenRouterPromptParams,
  type ListOpenRouterPromptsParams,
  type ListOpenRouterPromptsResult,
  type OpenRouterPrompt,
  type OpenRouterPromptDocument,
  type OpenRouterPromptFirestoreCollections,
  OpenRouterPromptState,
  type OpenRouterPromptVersion,
  type PublishOpenRouterPromptVersionParams,
  type PublishOpenRouterPromptVersionResult,
  type ReadOpenRouterPromptParams,
  type ReadOpenRouterPromptResult,
  type UpdateOpenRouterPromptParams,
  createOpenRouterPromptParamsType,
  listOpenRouterPromptsParamsType,
  openRouterPromptIdentity,
  openRouterPromptVersionId,
  publishOpenRouterPromptVersionParamsType,
  readOpenRouterPromptParamsType,
  updateOpenRouterPromptParamsType
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
 * Server actions for managing prompts.
 *
 * These exist instead of an Angular UI: prompt CRUD reaches the model API, and the existing callModel
 * MCP surface makes every one of them callable without building a screen for it.
 */
export abstract class OpenRouterPromptServerActions {
  abstract createOpenRouterPrompt(params: CreateOpenRouterPromptParams): Promise<OpenRouterPromptDocument>;
  abstract updateOpenRouterPrompt(params: UpdateOpenRouterPromptParams): Promise<(document: OpenRouterPromptDocument) => Promise<OpenRouterPromptDocument>>;
  abstract publishOpenRouterPromptVersion(params: PublishOpenRouterPromptVersionParams): Promise<(document: OpenRouterPromptDocument) => Promise<PublishOpenRouterPromptVersionResult>>;
  abstract readOpenRouterPrompt(params: ReadOpenRouterPromptParams): Promise<(document: OpenRouterPromptDocument) => Promise<ReadOpenRouterPromptResult>>;
  abstract listOpenRouterPrompts(params: ListOpenRouterPromptsParams): Promise<ListOpenRouterPromptsResult>;
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
    publishOpenRouterPromptVersion: publishOpenRouterPromptVersionFactory(context),
    readOpenRouterPrompt: readOpenRouterPromptFactory(context),
    listOpenRouterPrompts: listOpenRouterPromptsFactory(context)
  };
}

export function createOpenRouterPromptFactory({ firebaseServerActionTransformFunctionFactory, openRouterPromptCollection }: OpenRouterPromptServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(createOpenRouterPromptParamsType, async (params) => {
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
  });
}

export function updateOpenRouterPromptFactory({ firebaseServerActionTransformFunctionFactory, openRouterPromptCollection, openRouterPromptVersionCollectionFactory, openRouterPromptService }: OpenRouterPromptServerActionsContext) {
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

export function publishOpenRouterPromptVersionFactory({ firebaseServerActionTransformFunctionFactory, openRouterPromptCollection, openRouterPromptVersionCollectionFactory, openRouterPromptService }: OpenRouterPromptServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(publishOpenRouterPromptVersionParamsType, async (params) => {
    const { instructions, messages, config, notes, activate } = params;

    return async (document: OpenRouterPromptDocument) => {
      const modelConfig = (config ?? undefined) as Maybe<OpenRouterModelConfig>;
      const validation = validateOpenRouterModelConfig(modelConfig ?? {});

      if (!validation.valid) {
        throw new Error(`Cannot publish a version of OpenRouterPrompt "${document.id}": ${validation.errors.join(' ')}`);
      }

      const result = await openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
        const inTransaction = openRouterPromptCollection.documentAccessorForTransaction(transaction).loadDocument(document.documentRef);
        const prompt = await inTransaction.snapshotData();

        if (prompt == null) {
          throw new Error(`The OpenRouterPrompt "${document.id}" does not exist.`);
        }

        // Allocated from the prompt document inside the transaction rather than supplied by the caller:
        // two concurrent publishes picking the same number would silently overwrite one another.
        const version = prompt.lv + 1;
        const versionDocument = openRouterPromptVersionCollectionFactory(inTransaction).documentAccessorForTransaction(transaction).loadDocumentForId(openRouterPromptVersionId(version));

        const versionData: OpenRouterPromptVersion = {
          cat: new Date(),
          v: version,
          i: instructions,
          m: messages?.map(({ role, content }) => ({ r: role, c: content })),
          c: modelConfig,
          nt: notes
        };

        await versionDocument.accessor.set(versionData);
        await inTransaction.update({ lv: version, uat: new Date(), ...(activate ? { av: version, s: OpenRouterPromptState.ACTIVE } : undefined) });

        return { version, key: firestoreModelKey(openRouterPromptIdentity, document.id), activated: activate === true, warnings: validation.warnings };
      });

      openRouterPromptService.clearCachedPrompt(document.id);
      return result;
    };
  });
}

export function readOpenRouterPromptFactory({ firebaseServerActionTransformFunctionFactory, openRouterPromptVersionCollectionFactory }: OpenRouterPromptServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(readOpenRouterPromptParamsType, async (params) => {
    const { version: inputVersion, includeVersions } = params;

    return async (document: OpenRouterPromptDocument): Promise<ReadOpenRouterPromptResult> => {
      const prompt = await document.snapshotData();

      if (prompt == null) {
        throw new Error(`The OpenRouterPrompt "${document.id}" does not exist.`);
      }

      const versionCollection = openRouterPromptVersionCollectionFactory(document);
      const targetVersion = inputVersion ?? prompt.av;

      const versionData = targetVersion == null ? undefined : await versionCollection.documentAccessor().loadDocumentForId(openRouterPromptVersionId(targetVersion)).snapshotData();
      const versions = includeVersions ? (await versionCollection.queryDocument().getDocs()).map((x) => Number(x.id)) : undefined;

      return {
        key: document.id,
        name: prompt.n,
        description: prompt.d,
        state: prompt.s,
        activeVersion: prompt.av,
        latestVersion: prompt.lv,
        tags: prompt.t,
        version:
          versionData == null
            ? undefined
            : {
                version: versionData.v,
                instructions: versionData.i,
                messages: versionData.m?.map(({ r, c }) => ({ role: r, content: c })),
                config: versionData.c as Maybe<Record<string, unknown>>,
                notes: versionData.nt
              },
        versions
      };
    };
  });
}

export function listOpenRouterPromptsFactory({ firebaseServerActionTransformFunctionFactory, openRouterPromptCollection }: OpenRouterPromptServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(listOpenRouterPromptsParamsType, async (params) => {
    const { state, tag, limit: inputLimit } = params;
    const pageLimit = inputLimit ?? 100;

    const documents = await openRouterPromptCollection.queryDocument().getDocs();
    const snapshots = await Promise.all(documents.map(async (x) => ({ id: x.id, data: await x.snapshotData() })));

    const prompts = filterMaybeArrayValues(
      snapshots.map(({ id, data }) => {
        let result: Maybe<ListOpenRouterPromptsResult['prompts'][0]>;

        if (data != null && matchesOpenRouterPromptFilter(data, state, tag)) {
          result = { key: id, name: data.n, state: data.s, activeVersion: data.av, latestVersion: data.lv, tags: data.t };
        }

        return result;
      })
    ).slice(0, pageLimit);

    return { prompts };
  });
}

/**
 * Whether a prompt matches the listing filter.
 *
 * Filtered in memory rather than by query: the prompt collection is operational configuration measured
 * in dozens of documents, and a composite index plus an `array-contains` on an optional field would cost
 * more than it saves at that size.
 *
 * @param prompt - The prompt.
 * @param state - Optional state filter.
 * @param tag - Optional tag filter.
 * @returns True when the prompt matches.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function matchesOpenRouterPromptFilter(prompt: OpenRouterPrompt, state: Maybe<OpenRouterPromptState>, tag: Maybe<string>): boolean {
  return (state == null || prompt.s === state) && (tag == null || (prompt.t ?? []).includes(tag));
}
