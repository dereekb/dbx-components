import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type FirestoreContextReference, type FirestoreModelKey, firestoreModelId, firestoreModelKeyParentKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterModelConfig, type OpenRouterPromptDefinition, type OpenRouterPromptKey, validateOpenRouterModelConfig } from '@dereekb/openrouter';
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
    createOpenRouterPrompt: createOpenRouterPromptFactory(context),
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

/**
 * What one definition's seed transaction did.
 */
type SeedOpenRouterPromptOutcome = 'created' | 'published' | 'upToDate' | 'skipped';

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
 * than an implementation detail. This gets equivalent safety by a different mechanism — reading the
 * target version id puts it in the transaction's read set — which is only sound because that id is a
 * compile-time constant, something `CreateOpenRouterPromptVersionParams` cannot assert about an
 * arbitrary caller.
 *
 * @param context - The actions context.
 * @returns The seed action.
 */
export function seedOpenRouterPromptsFactory(context: OpenRouterPromptServerActionsContext) {
  const { openRouterPromptCollection, openRouterPromptVersionCollectionFactory, openRouterPromptService } = context;

  return async (params: SeedOpenRouterPromptsParams): Promise<SeedOpenRouterPromptsResult> => {
    const { promptKeys } = params;
    const keyFilter = promptKeys == null ? undefined : new Set(promptKeys);
    const definitions = openRouterPromptService.promptDefinitions.filter((x) => keyFilter == null || keyFilter.has(x.promptKey));
    const warnings: string[] = [];

    // Every definition is validated before anything is written: half-seeding a registry because entry
    // three is broken leaves a state no rerun explains.
    definitions.forEach((definition) => {
      const { promptKey, version, config } = definition;

      if (!Number.isInteger(version) || version < 1) {
        throw new Error(`Cannot seed OpenRouterPrompt "${promptKey}": the definition declares version ${version}, which is not an integer >= 1.`);
      }

      const validation = validateOpenRouterModelConfig(config);

      if (!validation.valid) {
        throw new Error(`Cannot seed OpenRouterPrompt "${promptKey}": ${validation.errors.join(' ')}`);
      }

      validation.warnings.forEach((warning) => warnings.push(`${promptKey}: ${warning}`));
    });

    /**
     * Seeds one definition in its own transaction.
     *
     * One transaction PER definition rather than one for the registry: the documents are disjoint, so a
     * contention retry on one must not roll the rest back, and a registry of any size must not approach
     * the 500-write ceiling.
     *
     * @param definition - The definition to publish.
     * @returns What the transaction did.
     */
    async function seedDefinition(definition: OpenRouterPromptDefinition): Promise<SeedOpenRouterPromptOutcome> {
      const { promptKey, version } = definition;

      return openRouterPromptCollection.firestoreContext.runTransaction(async (transaction) => {
        const promptDocument = openRouterPromptCollection.documentAccessorForTransaction(transaction).loadDocumentForId(promptKey);
        const versionCollection = openRouterPromptVersionCollectionFactory(promptDocument).documentAccessorForTransaction(transaction);
        const targetVersionDocument = versionCollection.loadDocumentForId(openRouterPromptVersionId(version));

        // Both addresses come from the definition alone, so they resolve together. Reading the target
        // puts it in the transaction's read set, which is what makes the pinned write race-safe.
        const [prompt, targetVersionExists] = await Promise.all([promptDocument.snapshotData(), targetVersionDocument.accessor.exists()]);

        const latestVersion = prompt?.lv ?? 0;
        // An ARCHIVED prompt is never resurrected: retirement is a deliberate act, and a scheduled
        // reseed silently undoing it is the same class of bug as reverting an operator's rename.
        const archived = prompt?.s === OpenRouterPromptState.ARCHIVED;
        const publish = !archived && version > latestVersion && !targetVersionExists;

        let outcome: SeedOpenRouterPromptOutcome;

        if (publish) {
          // The outgoing head's address comes from the prompt's own `lv`, so this read cannot batch
          // with the one that produced it. Strictly `<`: at `lv === version` the document under the
          // lock is the one this transaction is about to create. Existence-checked because `.update()`
          // throws on a missing document, and a `set` on a deleted version would resurrect it holding
          // nothing but a lock.
          const previousVersionDocument = latestVersion > 0 && latestVersion < version ? versionCollection.loadDocumentForId(openRouterPromptVersionId(latestVersion)) : undefined;
          const previousVersionExists = previousVersionDocument == null ? false : await previousVersionDocument.accessor.exists();

          if (previousVersionDocument != null && previousVersionExists) {
            await previousVersionDocument.update({ lk: true });
          }

          const versionData: OpenRouterPromptVersion = {
            cat: new Date(),
            v: version,
            i: definition.instructions,
            m: definition.messages?.map(({ role, content }) => ({ r: role, c: content })),
            c: definition.config,
            nt: `Seeded from the code definition declaring version ${version}.`
          };

          await targetVersionDocument.accessor.set(versionData);

          if (prompt == null) {
            await promptDocument.accessor.set({ cat: new Date(), n: definition.name, d: definition.description, s: OpenRouterPromptState.ACTIVE, lv: version, av: version });
          } else {
            // `n`/`d`/`t` are deliberately untouched: they are operator-editable through
            // updateOpenRouterPrompt, and a scheduled reseed reverting a rename is a silent regression.
            await promptDocument.update({ lv: version, av: version, s: OpenRouterPromptState.ACTIVE, uat: new Date() });
          }

          outcome = prompt == null ? 'created' : 'published';
        } else {
          // The only way to land on `upToDate` is a prompt whose `lv` already covers the declared
          // number AND whose document at that number is present — anything else is drift the seed
          // refuses to paper over by overwriting a number someone else wrote.
          outcome = archived || version > latestVersion || !targetVersionExists ? 'skipped' : 'upToDate';
        }

        return outcome;
      });
    }

    let promptsCreated = 0;
    let versionsPublished = 0;
    let upToDate = 0;
    let skipped = 0;

    for (const definition of definitions) {
      const outcome = await seedDefinition(definition);

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

      if (outcome === 'created' || outcome === 'published') {
        // Only the prompts that actually changed. Missing this leaves a scheduled reseed invisible for
        // the whole OPENROUTER_PROMPT_CACHE_DURATION window.
        openRouterPromptService.clearCachedPrompt(definition.promptKey);
      }
    }

    return { considered: definitions.length, promptsCreated, versionsPublished, upToDate, skipped, warnings };
  };
}
