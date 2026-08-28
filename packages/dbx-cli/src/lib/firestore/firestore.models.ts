import { type FirebaseAppModelContext, type FirebaseModelServiceGetter, type FirebaseModelsService, type FirebaseModelsServiceTypes, type FirestoreCollectionLike, type FirestoreContext, type FirestoreDocument, type FirestoreModelKey, type FirestoreModelType, type InContextFirebaseModelCollectionLoader, type InContextFirebaseModelLoader } from '@dereekb/firebase';
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
 *
 * `C` appears in exactly one position — the RETURN of {@link collections} — and that is deliberate.
 * Because the use is purely covariant, `CliFirestoreBinding<DemoFirestoreCollections>` is assignable
 * to `CliFirestoreBinding<object>`, which is what lets `CreateCliInput.firestore` keep accepting a
 * typed binding with no cast and keeps generics out of `CliContext` / `runCli` entirely.
 *
 * Adding `C` (or the models generic `Y`) to {@link models} or to
 * {@link CliFirestoreCollectionForModelInput} would put it in a PARAMETER position, and under
 * `strictFunctionTypes` that destroys the assignability above — cascading generics through
 * `CreateCliInput` → `createAuthMiddleware` → `createCliContext` → `CliContext`. Don't.
 *
 * @template C - The app's collections type, e.g. `DemoFirestoreCollections`.
 */
export interface CliFirestoreBinding<C extends object = object> {
  /**
   * The app's `make<App>FirestoreCollections`.
   */
  readonly collections: (firestoreContext: FirestoreContext) => C;
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
 * Input for {@link cliFirestoreBinding} and {@link cliFirestoreAccessorFactory}.
 *
 * `Y` sits in a PROPERTY position here, which is safe precisely because this is the INPUT type and
 * never the binding: nothing assigns a `CliFirestoreBindingInput` to `CreateCliInput.firestore`, so
 * the variance rule on {@link CliFirestoreBinding} does not apply. Capturing it is what lets
 * `cliFirestoreAccessorFactory` hand back the app's real model types.
 *
 * @template C - The app's collections type, e.g. `DemoFirestoreCollections`.
 * @template Y - The app's `<app>FirebaseModelServices` type.
 */
export interface CliFirestoreBindingInput<C extends object, Y extends FirebaseModelsService<any, FirebaseAppModelContext<C>> = FirebaseModelsService<any, FirebaseAppModelContext<C>>> {
  readonly collections: (firestoreContext: FirestoreContext) => C;
  readonly models: Y;
  readonly collectionForModel?: (input: CliFirestoreCollectionForModelInput) => Maybe<FirestoreCollectionLike<unknown>>;
}

/**
 * Builds a {@link CliFirestoreBinding} from an app's collections factory and model services.
 *
 * Typed so the app site needs no cast — `C` is carried through on {@link CliFirestoreBinding.collections},
 * and the one erasure the CLI requires (the app's model-service union → {@link CliFirestoreModelService})
 * is absorbed here rather than at every call site.
 *
 * The `{ app: collections }` context handed to the model service is COMPLETE for the two members
 * the CLI uses: `FirebasePermissionContext`, `FirebasePermissionErrorContext` and
 * `FirebaseAuthContext` are all-optional, `firebaseModelsService` self-injects `service`, and
 * neither `loadModelForKey` nor `getFirestoreCollection` reads `auth`.
 *
 * Most apps should reach for {@link cliFirestoreAccessorFactory} instead, which calls this and ALSO
 * hands back a typed accessor for the app's own actions. Use this directly only when the binding is
 * all you need.
 *
 * @param input - The app's collections factory, model services, and optional per-model override.
 * @returns The binding `runCli` accepts, still carrying `C`.
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
export function cliFirestoreBinding<C extends object>(input: CliFirestoreBindingInput<C>): CliFirestoreBinding<C> {
  return {
    collections: input.collections,
    models: input.models as unknown as CliFirestoreModelsService,
    collectionForModel: input.collectionForModel
  };
}

// MARK: Resolved models
/**
 * The default `Y` for {@link CliFirestoreModels}: a registry admitting ANY `FirestoreModelType`, with
 * every model erased to `unknown`.
 *
 * Chosen so the defaulted generic form reproduces the pre-`Y` interface member-for-member — which is
 * why `CliContext.getFirestoreModels?: () => Promise<CliFirestoreModels>` needs no change, and why
 * every string-dispatched caller inside `dbx-cli` still compiles.
 */
export type CliErasedFirebaseModelsService = FirebaseModelsService<Record<FirestoreModelType, FirebaseModelServiceGetter<any, unknown>>, any>;

/**
 * Resolves the app's REAL `T` / `D` for one registered model type out of its `<app>FirebaseModelServices`.
 *
 * Deliberately only the loader half — {@link CliFirestoreModelService} explains why the permission
 * half (`roleMapForModel`, `requireRole`, `use`) is excluded: `dbx-cli` authorizes through
 * `firestore.rules`, not the app's role map, and the `{ app: collections }` context it hands the
 * service carries no `auth` for a role map to read.
 *
 * @template Y - The app's `<app>FirebaseModelServices` type.
 * @template K - The registered model type to resolve.
 */
export type CliFirestoreModelServiceForType<Y extends FirebaseModelsService<any, any>, K extends FirebaseModelsServiceTypes<Y>> = Y extends FirebaseModelsService<infer X, infer C> ? (K extends keyof X ? (X[K] extends FirebaseModelServiceGetter<C, infer T, infer D, any> ? InContextFirebaseModelLoader<T, D> & InContextFirebaseModelCollectionLoader<T, D> : never) : never) : never;

/**
 * The per-invocation, session-bound view of an app's models over a direct Firestore connection.
 *
 * @template C - The app's collections type, e.g. `DemoFirestoreCollections`.
 * @template Y - The app's `<app>FirebaseModelServices` type. Defaults to
 *   {@link CliErasedFirebaseModelsService}, which reproduces the erased pre-`Y` interface exactly.
 */
export interface CliFirestoreModels<C extends object = object, Y extends FirebaseModelsService<any, any> = CliErasedFirebaseModelsService> {
  readonly session: CliFirestoreSessionContext;
  /**
   * The app's collections object, built against the session's `FirestoreContext`.
   */
  readonly collections: C;
  /**
   * The binding the app supplied, for consumers that need `collectionForModel`.
   *
   * Typed `CliFirestoreBinding<C>`, NOT `CliFirestoreBinding<C, Y>` — `Y` must never reach the
   * binding, or the binding stops being assignable to `CliFirestoreBinding<object>`. See the
   * variance note on {@link CliFirestoreBinding}.
   */
  readonly binding: CliFirestoreBinding<C>;
  /**
   * The app's `<app>FirebaseModelServices`, at its real type.
   *
   * Runtime-identical to `binding.models` — the same object — but honestly typed, so callers that
   * hold a typed `CliFirestoreModels` can reach the full service (permissions included) when they
   * genuinely want it, rather than the CLI-erased slice {@link serviceFor} hands back.
   */
  readonly models: Y;
  readonly allTypes: () => FirebaseModelsServiceTypes<Y>[];
  /**
   * Resolves the model service for `modelType`, validating against {@link allTypes} FIRST.
   *
   * The validation is load-bearing, not defensive: `firebaseModelsService` indexes its factory map
   * and calls the result immediately, so an unregistered type surfaces as a bare `TypeError`
   * instead of a `CliError` the CLI can render.
   *
   * An OVERLOAD PAIR, specific-first, and the order is what keeps this non-breaking. A literal
   * (`serviceFor('guestbook')`) satisfies `K extends FirebaseModelsServiceTypes<Y>` and gets the app's
   * real `GuestbookDocument`; a runtime `string` off argv does not, and falls through to the erased
   * signature — which is why every string-dispatched caller in `dbx-cli` compiles untouched. Under
   * the default erased `Y`, `FirebaseModelsServiceTypes<Y>` widens to `FirestoreModelType` and
   * signature 1 collapses into signature 2.
   */
  readonly serviceFor: {
    <K extends FirebaseModelsServiceTypes<Y>>(modelType: K): CliFirestoreModelServiceForType<Y, K>;
    (modelType: FirestoreModelType): CliFirestoreModelService;
  };
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
  readonly modelTypeForCollection: (collectionName: string) => FirebaseModelsServiceTypes<Y>;
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
export interface CreateCliFirestoreModelsInput<C extends object = object> {
  readonly binding: CliFirestoreBinding<C>;
  readonly session: CliFirestoreSessionContext;
}

/**
 * Binds an app's {@link CliFirestoreBinding} to an open session.
 *
 * `Y` is inferred from the caller's annotation rather than from `input` — the binding erased its
 * models to {@link CliFirestoreModelsService} on the way in (it must, for variance), so there is
 * nothing left here to infer it from. {@link cliFirestoreAccessorFactory} is what re-attaches the
 * app's real `Y`, having captured it at the app site.
 *
 * @param input - The binding and the open session.
 * @returns The {@link CliFirestoreModels} view.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createCliFirestoreModels<C extends object = object, Y extends FirebaseModelsService<any, any> = CliErasedFirebaseModelsService>(input: CreateCliFirestoreModelsInput<C>): CliFirestoreModels<C, Y> {
  const { binding, session } = input;
  const collections = binding.collections(session.firestoreContext);
  const collectionNameCache = new Map<FirestoreModelType, FirestoreModelType>();

  // the one cast this generic buys: TypeScript cannot check an implementation against
  // `CliFirestoreModelServiceForType<Y, K>` — a conditional type it cannot resolve while `Y` is still
  // an unresolved type parameter. Every member below is runtime-correct for any `Y` the app supplies,
  // since `Y` only ever renames what `binding.models` already returns. `@dereekb/firebase` makes the
  // identical concession in `firebaseModelsService` / `inContextFirebaseModelsServiceFactory`.
  return {
    session,
    collections,
    binding,
    models: binding.models,
    allTypes: () => binding.models.allTypes(),
    serviceFor: (modelType: FirestoreModelType) => {
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
    modelTypeForCollection: (collectionName: string) => resolveModelTypeForCollection({ binding, collections, collectionName, cache: collectionNameCache })
  } as unknown as CliFirestoreModels<C, Y>;
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
      suggestion: `The query catalog records collection names, which must match a registered model's \`firestoreModelIdentity\` collection name. Known collections: ${Array.from(cache.keys()).sort().join(', ')}.`
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
