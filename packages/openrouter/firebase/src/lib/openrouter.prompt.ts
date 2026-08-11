import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterInputRole, type OpenRouterModelConfig, type OpenRouterPromptKey, type OpenRouterPromptVersionNumber, type OpenRouterResolvedPrompt } from '@dereekb/openrouter';
import { AbstractFirestoreDocument, type CollectionGroup, type CollectionReference, type FirestoreCollection, type FirestoreCollectionGroup, type FirestoreCollectionWithParent, type FirestoreContext, type FirestoreModelKey, firestoreDate, firestoreEnum, firestoreModelIdentity, firestoreNumber, firestoreString, optionalFirestoreArray, optionalFirestoreDate, optionalFirestoreField, optionalFirestoreNumber, optionalFirestoreString, snapshotConverterFunctions } from '@dereekb/firebase';
import { openRouterPromptVersionId } from './openrouter.prompt.id';

/**
 * Provides access to the {@link OpenRouterPrompt} collection and its version subcollection.
 *
 * @dbxModelGroup OpenRouterPrompt
 */
export interface OpenRouterPromptFirestoreCollections {
  readonly openRouterPromptCollection: OpenRouterPromptFirestoreCollection;
  readonly openRouterPromptVersionCollectionFactory: OpenRouterPromptVersionFirestoreCollectionFactory;
  readonly openRouterPromptVersionCollectionGroup: OpenRouterPromptVersionFirestoreCollectionGroup;
}

/**
 * Union of all OpenRouterPrompt model identity types.
 */
export type OpenRouterPromptTypes = typeof openRouterPromptIdentity | typeof openRouterPromptVersionIdentity;

// MARK: OpenRouterPrompt
/**
 * Identity for {@link OpenRouterPrompt} documents. Model type: `openRouterPrompt`, collection: `orp`.
 */
export const openRouterPromptIdentity = firestoreModelIdentity('openRouterPrompt', 'orp');

/**
 * Lifecycle state of an {@link OpenRouterPrompt}.
 */
export enum OpenRouterPromptState {
  /**
   * Created but not yet servable. A caller resolving this prompt gets an error rather than a guess.
   */
  DRAFT = 0,
  /**
   * Servable.
   */
  ACTIVE = 1,
  /**
   * Retired. Retained so historical runs stay explicable, but no longer servable.
   */
  ARCHIVED = 2
}

/**
 * A reusable prompt.
 *
 * This is the replacement for an OpenAI Prompt Object. The document id IS the prompt's key
 * (`kaia-resume-parser`), so a call site names the prompt in readable text instead of quoting an
 * opaque `pmpt_…`, and the content, model, reasoning effort, and output format live here rather than
 * in a vendor dashboard.
 *
 * The prompt document holds only identity and version pointers; everything servable lives on an
 * {@link OpenRouterPromptVersion}.
 *
 * @dbxModel
 * @dbxModelRead admin
 * @dbxModelUpdate admin
 */
export interface OpenRouterPrompt {
  /**
   * Date this prompt was created at.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Date this prompt was last updated at.
   *
   * @dbxModelVariable updatedAt
   */
  uat?: Maybe<Date>;
  /**
   * Human-readable name.
   *
   * @dbxModelVariable name
   */
  n: string;
  /**
   * What this prompt is for.
   *
   * @dbxModelVariable description
   */
  d?: Maybe<string>;
  /**
   * Lifecycle state.
   *
   * @dbxModelVariable state
   */
  s: OpenRouterPromptState;
  /**
   * Version served when a caller does not pin one.
   *
   * Absent until a version is published and promoted, which is what keeps an unfinished prompt from
   * being served by accident.
   *
   * @dbxModelVariable activeVersion
   */
  av?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * Highest version number allocated so far — the allocator for the next one.
   *
   * @dbxModelVariable latestVersion
   */
  lv: OpenRouterPromptVersionNumber;
  /**
   * Free-form tags for grouping.
   *
   * @dbxModelVariable tags
   */
  t?: Maybe<string[]>;
}

/**
 * Roles for an {@link OpenRouterPrompt}. Prompts are operational configuration, so reads and writes
 * are administrative.
 */
export type OpenRouterPromptRoles = GrantedReadRole | GrantedUpdateRole | 'publish';

export class OpenRouterPromptDocument extends AbstractFirestoreDocument<OpenRouterPrompt, OpenRouterPromptDocument, typeof openRouterPromptIdentity> {
  get modelIdentity() {
    return openRouterPromptIdentity;
  }
}

export const openRouterPromptConverter = snapshotConverterFunctions<OpenRouterPrompt>({
  fields: {
    cat: firestoreDate({ saveDefaultAsNow: true }),
    uat: optionalFirestoreDate(),
    n: firestoreString({ default: '' }),
    d: optionalFirestoreString(),
    s: firestoreEnum<OpenRouterPromptState>({ default: OpenRouterPromptState.DRAFT }),
    av: optionalFirestoreNumber(),
    lv: firestoreNumber({ default: 0 }),
    t: optionalFirestoreArray<string>({ filterUnique: true, dontStoreIfEmpty: true })
  }
});

/**
 * Returns the root Firestore collection reference for {@link OpenRouterPrompt} documents.
 *
 * @param context - The FirestoreContext used to resolve the collection.
 * @returns A typed CollectionReference for the openRouterPrompt collection.
 */
export function openRouterPromptCollectionReference(context: FirestoreContext): CollectionReference<OpenRouterPrompt> {
  return context.collection(openRouterPromptIdentity.collectionName);
}

export type OpenRouterPromptFirestoreCollection = FirestoreCollection<OpenRouterPrompt, OpenRouterPromptDocument>;

/**
 * Creates the Firestore collection accessor for {@link OpenRouterPrompt} documents.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection.
 * @returns An OpenRouterPromptFirestoreCollection.
 */
export function openRouterPromptFirestoreCollection(firestoreContext: FirestoreContext): OpenRouterPromptFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: openRouterPromptIdentity,
    converter: openRouterPromptConverter,
    collection: openRouterPromptCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new OpenRouterPromptDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: OpenRouterPromptVersion
/**
 * Identity for {@link OpenRouterPromptVersion} documents. Subcollection of {@link OpenRouterPrompt}.
 * Model type: `openRouterPromptVersion`, collection: `orpv`.
 */
export const openRouterPromptVersionIdentity = firestoreModelIdentity(openRouterPromptIdentity, 'openRouterPromptVersion', 'orpv');

/**
 * A seed message stored on a version, in short-key persisted form.
 *
 * @dbxModelSubObject
 */
export interface OpenRouterPromptVersionMessage {
  /**
   * Message role.
   *
   * @dbxModelVariable role
   */
  r: OpenRouterInputRole;
  /**
   * Message content.
   *
   * @dbxModelVariable content
   */
  c: string;
}

/**
 * One published, immutable version of a prompt.
 *
 * Version pinning is the one thing OpenRouter Presets structurally cannot do — a preset always
 * resolves to latest — so it is the reason this model exists rather than deferring to a preset. A run
 * records the version it used, so a result is always traceable to the exact prompt text that produced
 * it, and a historical run can be replayed against that same text.
 *
 * Versions are treated as immutable once published: editing one would silently change the meaning of
 * every past run that cites it.
 *
 * @dbxModel
 * @dbxModelRead admin
 */
export interface OpenRouterPromptVersion {
  /**
   * Date this version was published at.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * The version number. Matches the (unpadded) document id.
   *
   * @dbxModelVariable version
   */
  v: OpenRouterPromptVersionNumber;
  /**
   * System prompt.
   *
   * @dbxModelVariable instructions
   */
  i?: Maybe<string>;
  /**
   * Static seed messages, emitted before the caller's dynamic input.
   *
   * @dbxModelVariable messages
   */
  m?: Maybe<OpenRouterPromptVersionMessage[]>;
  /**
   * Model configuration.
   *
   * Stored as PASSTHROUGH JSON, deliberately not a strict converter. OpenRouter's parameter surface
   * moves fast, and a strict converter would silently drop any field it did not know about — turning
   * every OpenRouter release into a config-corrupting event. `OpenRouterModelConfig` types it in
   * TypeScript for autocomplete and call-time validation instead: strict types in code, loose storage.
   *
   * @dbxModelVariable config
   */
  c?: Maybe<OpenRouterModelConfig>;
  /**
   * Why this version was published.
   *
   * @dbxModelVariable notes
   */
  nt?: Maybe<string>;
  /**
   * Model key of whoever published it.
   *
   * @dbxModelVariable createdBy
   */
  by?: Maybe<FirestoreModelKey>;
}

/**
 * Roles for an {@link OpenRouterPromptVersion}. Versions are immutable once published, so there is no
 * update role.
 */
export type OpenRouterPromptVersionRoles = GrantedReadRole;

export class OpenRouterPromptVersionDocument extends AbstractFirestoreDocument<OpenRouterPromptVersion, OpenRouterPromptVersionDocument, typeof openRouterPromptVersionIdentity> {
  get modelIdentity() {
    return openRouterPromptVersionIdentity;
  }
}

export const openRouterPromptVersionConverter = snapshotConverterFunctions<OpenRouterPromptVersion>({
  fields: {
    cat: firestoreDate({ saveDefaultAsNow: true }),
    v: firestoreNumber({ default: 0 }),
    i: optionalFirestoreString(),
    m: optionalFirestoreArray<OpenRouterPromptVersionMessage>({ dontStoreIfEmpty: true }),
    c: optionalFirestoreField<OpenRouterModelConfig>(),
    nt: optionalFirestoreString(),
    by: optionalFirestoreString()
  }
});

/**
 * Creates a factory that produces {@link OpenRouterPromptVersion} subcollection references for a given
 * {@link OpenRouterPromptDocument} parent.
 *
 * @param context - Firestore context to create subcollection references from.
 * @returns A factory function that creates collection references for a given prompt parent.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterPromptVersionCollectionReferenceFactory(context: FirestoreContext): (prompt: OpenRouterPromptDocument) => CollectionReference<OpenRouterPromptVersion> {
  return (prompt: OpenRouterPromptDocument) => {
    return context.subcollection(prompt.documentRef, openRouterPromptVersionIdentity.collectionName);
  };
}

export type OpenRouterPromptVersionFirestoreCollection = FirestoreCollectionWithParent<OpenRouterPromptVersion, OpenRouterPrompt, OpenRouterPromptVersionDocument, OpenRouterPromptDocument>;
export type OpenRouterPromptVersionFirestoreCollectionFactory = (parent: OpenRouterPromptDocument) => OpenRouterPromptVersionFirestoreCollection;

/**
 * Creates an {@link OpenRouterPromptVersionFirestoreCollectionFactory} bound to the given context.
 *
 * @param firestoreContext - Firestore context to bind the collection factory to.
 * @returns A factory that creates typed subcollections for version documents.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterPromptVersionFirestoreCollectionFactory(firestoreContext: FirestoreContext): OpenRouterPromptVersionFirestoreCollectionFactory {
  const factory = openRouterPromptVersionCollectionReferenceFactory(firestoreContext);

  return (parent: OpenRouterPromptDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      modelIdentity: openRouterPromptVersionIdentity,
      converter: openRouterPromptVersionConverter,
      collection: factory(parent),
      makeDocument: (accessor, documentAccessor) => new OpenRouterPromptVersionDocument(accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}

/**
 * Creates a collection group reference for querying every {@link OpenRouterPromptVersion} across all
 * prompts.
 *
 * @param context - Firestore context to create the collection group reference from.
 * @returns A typed collection group.
 */
export function openRouterPromptVersionCollectionReference(context: FirestoreContext): CollectionGroup<OpenRouterPromptVersion> {
  return context.collectionGroup(openRouterPromptVersionIdentity.collectionName);
}

export type OpenRouterPromptVersionFirestoreCollectionGroup = FirestoreCollectionGroup<OpenRouterPromptVersion, OpenRouterPromptVersionDocument>;

/**
 * Creates a typed {@link OpenRouterPromptVersionFirestoreCollectionGroup} bound to the given context.
 *
 * @param firestoreContext - Firestore context to bind the collection group to.
 * @returns A typed Firestore collection group.
 */
export function openRouterPromptVersionFirestoreCollectionGroup(firestoreContext: FirestoreContext): OpenRouterPromptVersionFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: openRouterPromptVersionIdentity,
    converter: openRouterPromptVersionConverter,
    queryLike: openRouterPromptVersionCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new OpenRouterPromptVersionDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Utility
/**
 * Converts a stored version document into the resolved prompt the request builder consumes.
 *
 * @param promptKey - The prompt key the version belongs to.
 * @param version - The stored version.
 * @returns The resolved prompt.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterResolvedPromptForVersion(promptKey: OpenRouterPromptKey, version: OpenRouterPromptVersion): OpenRouterResolvedPrompt {
  return {
    promptKey,
    version: version.v,
    instructions: version.i,
    messages: version.m?.map(({ r, c }) => ({ role: r, content: c })),
    config: version.c ?? {}
  };
}

/**
 * The document id of a version, from its number.
 *
 * Re-exported here so a caller reading a version does not need to reach for the id module separately.
 */
export const openRouterPromptVersionDocumentId = openRouterPromptVersionId;
