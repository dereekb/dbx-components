import { type FirebaseAppModelContext, type FirebaseModelsService, type FirestoreCollectionLike, type FirestoreContext, type FirestoreDocument, type FirestoreModelKey, type FirestoreModelType } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type CliContext } from '../context/cli.context';
import { CliError } from '../util/output';
import { type CliFirestoreSessionContext } from './firestore.session';

// MARK: Binding
/**
 * The slice of a `FirebaseModelService` the CLI's generic direct-Firestore reads need.
 *
 * Only the two members that never touch `roleMapForModel`: `dbx-cli` reads through Firestore
 * security rules, not through the app's role map, so the permission half of the service is
 * deliberately unused here.
 */
export interface CliFirestoreModelService {
  readonly loadModelForKey: (key: FirestoreModelKey) => FirestoreDocument<unknown>;
  readonly getFirestoreCollection: () => FirestoreCollectionLike<unknown>;
}

/**
 * The callable shape of an app's `<app>FirebaseModelServices`, erased to what the CLI needs.
 */
export type CliFirestoreModelsService = ((modelType: FirestoreModelType, context: { readonly app: unknown }) => CliFirestoreModelService) & {
  allTypes(): FirestoreModelType[];
};

/**
 * Input for a {@link CliFirestoreBinding.collectionForModel} override.
 */
export interface CliFirestoreCollectionForModelInput {
  readonly collections: object;
  readonly modelType: FirestoreModelType;
  readonly parentKey?: FirestoreModelKey;
}

/**
 * The one app-supplied hook that makes generic direct-Firestore commands possible.
 *
 * `dbx-cli` cannot import an app's collections factory — that is the whole reason there is no
 * generic direct command without this. Supplying it wires `firestore-get` / `firestore-query`
 * for EVERY registered model at once; there is no per-model codegen.
 */
export interface CliFirestoreBinding {
  /**
   * The app's `make<App>FirestoreCollections`.
   */
  readonly collections: (firestoreContext: FirestoreContext) => object;
  /**
   * The app's `<app>FirebaseModelServices`.
   */
  readonly models: CliFirestoreModelsService;
  /**
   * Escape hatch for models whose registered collection cannot be parent-scoped generically
   * (e.g. a paged-items collection). Return `undefined` to fall through to the derived scoping.
   */
  readonly collectionForModel?: (input: CliFirestoreCollectionForModelInput) => Maybe<FirestoreCollectionLike<unknown>>;
}

/**
 * Input for {@link cliFirestoreBinding}.
 */
export interface CliFirestoreBindingInput<C extends object> {
  readonly collections: (firestoreContext: FirestoreContext) => C;
  readonly models: FirebaseModelsService<any, FirebaseAppModelContext<C>>;
  readonly collectionForModel?: (input: CliFirestoreCollectionForModelInput) => Maybe<FirestoreCollectionLike<unknown>>;
}

/**
 * Builds a {@link CliFirestoreBinding} from an app's collections factory and model services.
 *
 * Typed so the app site needs no cast — the one erasure the CLI requires (`C` → `object`, and the
 * app's model-service union → {@link CliFirestoreModelService}) is absorbed here rather than at
 * every call site.
 *
 * The `{ app: collections }` context handed to the model service is COMPLETE for the two members
 * the CLI uses: `FirebasePermissionContext`, `FirebasePermissionErrorContext` and
 * `FirebaseAuthContext` are all-optional, `firebaseModelsService` self-injects `service`, and
 * neither `loadModelForKey` nor `getFirestoreCollection` reads `auth`.
 *
 * @param input - The app's collections factory, model services, and optional per-model override.
 * @returns The erased binding `runCli` accepts.
 *
 * @example
 * ```ts
 * runCli({
 *   firestore: cliFirestoreBinding({ collections: makeDemoFirestoreCollections, models: demoFirebaseModelServices })
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirestoreBinding<C extends object>(input: CliFirestoreBindingInput<C>): CliFirestoreBinding {
  return {
    collections: input.collections as (firestoreContext: FirestoreContext) => object,
    models: input.models as unknown as CliFirestoreModelsService,
    collectionForModel: input.collectionForModel
  };
}

// MARK: Resolved models
/**
 * The per-invocation, session-bound view of an app's models over a direct Firestore connection.
 */
export interface CliFirestoreModels {
  readonly session: CliFirestoreSessionContext;
  /**
   * The app's collections object, built against the session's `FirestoreContext`.
   */
  readonly collections: object;
  /**
   * The binding the app supplied, for consumers that need `collectionForModel`.
   */
  readonly binding: CliFirestoreBinding;
  readonly allTypes: () => FirestoreModelType[];
  /**
   * Resolves the model service for `modelType`, validating against {@link allTypes} FIRST.
   *
   * The validation is load-bearing, not defensive: `firebaseModelsService` indexes its factory map
   * and calls the result immediately, so an unregistered type surfaces as a bare `TypeError`
   * instead of a `CliError` the CLI can render.
   */
  readonly serviceFor: (modelType: FirestoreModelType) => CliFirestoreModelService;
  /**
   * Resolves a SHORT COLLECTION NAME (`gb`, `gbe`) to the `modelType` the app registered its service
   * under (`guestbook`, `guestbookEntry`).
   *
   * The query catalog records the collection name, not the model type — that is what
   * `firestore.indexes.json` keys on and what `CliModelManifestEntry.collectionPrefix` joins to — but
   * `<app>FirebaseModelServices` is keyed by model type. The join is derived from the registered
   * collections' own `modelIdentity` rather than from a manifest, so it works for every app with no
   * extra wiring.
   *
   * Memoized: resolving walks `allTypes()` building each service's collection until it matches.
   */
  readonly modelTypeForCollection: (collectionName: string) => FirestoreModelType;
}

/**
 * Resolves the direct-Firestore model view for the current invocation, opening the session on
 * first use.
 *
 * @param context - The live CLI context.
 * @returns The session-bound {@link CliFirestoreModels}.
 * @throws {CliError} When the CLI was not configured with a `firestore` binding, or the session cannot be opened.
 */
export async function requireCliFirestoreModels(context: CliContext): Promise<CliFirestoreModels> {
  const getFirestoreModels = context.getFirestoreModels;

  if (!getFirestoreModels) {
    throw new CliError({
      message: 'This CLI is not configured for generic direct-Firestore reads.',
      code: 'INVALID_ARGUMENT',
      suggestion: 'Pass `firestore: cliFirestoreBinding({ collections, models })` to `runCli()`.'
    });
  }

  return getFirestoreModels();
}

/**
 * Input for {@link createCliFirestoreModels}.
 */
export interface CreateCliFirestoreModelsInput {
  readonly binding: CliFirestoreBinding;
  readonly session: CliFirestoreSessionContext;
}

/**
 * Binds an app's {@link CliFirestoreBinding} to an open session.
 *
 * @param input - The binding and the open session.
 * @returns The {@link CliFirestoreModels} view.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createCliFirestoreModels(input: CreateCliFirestoreModelsInput): CliFirestoreModels {
  const { binding, session } = input;
  const collections = binding.collections(session.firestoreContext);
  const collectionNameCache = new Map<FirestoreModelType, FirestoreModelType>();

  return {
    session,
    collections,
    binding,
    allTypes: () => binding.models.allTypes(),
    serviceFor: (modelType) => {
      const allTypes = binding.models.allTypes();

      if (!allTypes.includes(modelType)) {
        throw new CliError({
          message: `Unknown model type "${modelType}".`,
          code: 'INVALID_ARGUMENT',
          suggestion: `Known model types: ${[...allTypes].sort().join(', ')}.`
        });
      }

      return binding.models(modelType, { app: collections });
    },
    modelTypeForCollection: (collectionName) => resolveModelTypeForCollection({ binding, collections, collectionName, cache: collectionNameCache })
  };
}

/**
 * Resolves a short collection name to its registered model type, memoizing every identity it sees on
 * the way so a second lookup is free.
 *
 * @param input - The binding, the built collections, the collection name, and the shared cache.
 * @param input.binding - The app-supplied binding.
 * @param input.collections - The built collections object.
 * @param input.collectionName - The short collection name to resolve.
 * @param input.cache - Cache of already-resolved collection names.
 * @returns The model type registered for that collection.
 * @throws {CliError} When no registered model declares that collection name.
 */
function resolveModelTypeForCollection(input: { readonly binding: CliFirestoreBinding; readonly collections: object; readonly collectionName: string; readonly cache: Map<string, FirestoreModelType> }): FirestoreModelType {
  const { binding, collections, collectionName, cache } = input;
  let result = cache.get(collectionName);

  if (result == null) {
    for (const modelType of binding.models.allTypes()) {
      // an app may register a model whose collection accessor throws when its parent is absent; a
      // model that cannot even report its identity is not the one being looked for
      const identity = tryReadCollectionIdentity(binding, collections, modelType);

      if (identity != null) {
        cache.set(identity, modelType);

        if (identity === collectionName) {
          result = modelType;
          break;
        }
      }
    }
  }

  if (result == null) {
    throw new CliError({
      message: `No registered model uses the Firestore collection "${collectionName}".`,
      code: 'INVALID_ARGUMENT',
      suggestion: `The query catalog records collection names, which must match a registered model's \`firestoreModelIdentity\` collection name. Known collections: ${[...cache.keys()].sort().join(', ')}.`
    });
  }

  return result;
}

function tryReadCollectionIdentity(binding: CliFirestoreBinding, collections: object, modelType: FirestoreModelType): string | undefined {
  let result: string | undefined;

  try {
    result = binding.models(modelType, { app: collections }).getFirestoreCollection().modelIdentity.collectionName;
  } catch {
    result = undefined;
  }

  return result;
}
