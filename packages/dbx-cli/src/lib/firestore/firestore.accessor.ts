import { type FirebaseAppModelContext, type FirebaseModelsService } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type GetModelOverHttpResult, type GetMultipleModelsOverHttpResult } from '../api/call-model.client';
import { type CliContext, requireCliFirestoreSession } from '../context/cli.context';
import { verboseLog } from '../util/output';
import { cliFirestoreBinding, createCliFirestoreModels, type CliFirestoreBinding, type CliFirestoreBindingInput, type CliFirestoreModels } from './firestore.models';
import { getModelOverFirestore, getMultipleModelsOverFirestore } from './firestore.read';

/**
 * A callable that resolves the app's TYPED direct-Firestore view for the current invocation, plus the
 * binding to wire the CLI with.
 *
 * The one place an app names its `<X>FirestoreCollections`: `cliFirestoreAccessorFactory` captures
 * both `C` and `Y` at the app site, and hands them back on every call — so an action reads through
 * `collections.guestbookCollection` and `serviceFor('guestbook')` at the app's real types instead of
 * rebuilding the collections itself to recover them.
 *
 * @template C - The app's collections type, e.g. `DemoFirestoreCollections`.
 * @template Y - The app's `<app>FirebaseModelServices` type.
 */
export type CliFirestoreAccessorFactory<C extends object, Y extends FirebaseModelsService<any, any>> = ((context: CliContext) => Promise<CliFirestoreAccessor<C, Y>>) & {
  /**
   * The binding to hand `runCli({ firestore })`, `buildTestCliContext({ firestore })`, and
   * `createFirestoreSessionDoctorCheck({ firestore })`.
   *
   * Sharing THIS object — rather than calling `cliFirestoreBinding` again with the same arguments —
   * is what lets the accessor reuse the context's memoized collections instead of building a second
   * copy: the reuse branch is an identity check, and two separate `cliFirestoreBinding` calls produce
   * two non-identical bindings.
   */
  readonly binding: CliFirestoreBinding<C>;
};

/**
 * The typed direct-Firestore view an app's actions read through.
 *
 * A {@link CliFirestoreModels} carrying the app's real `C` / `Y`, plus the two read helpers, so an
 * action never has to import `getModelOverFirestore` alongside it.
 *
 * @template C - The app's collections type.
 * @template Y - The app's `<app>FirebaseModelServices` type.
 */
export type CliFirestoreAccessor<C extends object, Y extends FirebaseModelsService<any, any>> = CliFirestoreModels<C, Y> & {
  /**
   * Reads one document by model key, returning the same `{ key, data }` envelope
   * `GET /model/<type>/get` returns.
   */
  readonly readModel: <T = unknown>(modelType: string, key: string) => Promise<GetModelOverHttpResult<Maybe<T>>>;
  /**
   * Batch-reads documents by model key, returning the same `{ results, errors }` envelope the model
   * API's `getMany` returns.
   */
  readonly readMultipleModels: <T = unknown>(modelType: string, keys: ReadonlyArray<string>) => Promise<GetMultipleModelsOverHttpResult<Maybe<T>>>;
};

/**
 * Registers an app's collections factory + model services once, and returns the accessor its actions
 * read through.
 *
 * Resolution order on each call, three cases:
 *
 * 1. the context was wired with THIS binding (`models.binding === binding`) → reuse its memoized
 *    view. The identity check is what makes the `object` → `C` narrowing sound: `collections`
 *    provably came from `binding.collections`, which returns `C`.
 * 2. the context has NO binding → build a view from `requireCliFirestoreSession(context)`, so an app
 *    can use the accessor in its actions without also passing `runCli({ firestore })`.
 * 3. the context was wired with a DIFFERENT binding → build a second view and `verboseLog` about it,
 *    rather than silently asserting that someone else's `collections` is a `C`.
 *
 * @param input - The app's collections factory, model services, and optional per-model override.
 * @returns The callable accessor, carrying {@link CliFirestoreAccessorFactory.binding}.
 *
 * @example
 * ```ts
 * export const demoCliFirestore = cliFirestoreAccessorFactory({
 *   collections: makeDemoFirestoreCollections,
 *   models: demoFirebaseModelServices
 * });
 *
 * // wiring
 * runCli({ firestore: demoCliFirestore.binding });
 *
 * // in an action
 * const { collections, session } = await demoCliFirestore(input.context);
 * const entries = await collections.guestbookCollection.queryDocument(...).getDocs();
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirestoreAccessorFactory<C extends object, Y extends FirebaseModelsService<any, FirebaseAppModelContext<C>>>(input: CliFirestoreBindingInput<C, Y>): CliFirestoreAccessorFactory<C, Y> {
  const binding = cliFirestoreBinding<C>(input);

  async function resolve(context: CliContext): Promise<CliFirestoreAccessor<C, Y>> {
    const existing = await context.getFirestoreModels?.();
    let models: CliFirestoreModels<C, Y>;

    if (existing?.binding === binding) {
      // case 1 — same binding, so `existing.collections` came from `binding.collections` and IS a `C`
      models = existing as CliFirestoreModels<C, Y>;
    } else {
      if (existing != null) {
        // case 3 — a foreign binding's `collections` is not provably a `C`, so build our own rather
        // than assert. Loud, because paying for two collections objects is a wiring mistake worth seeing.
        verboseLog('firestore accessor: the context was wired with a DIFFERENT binding — building a second collections view rather than reusing it');
      }

      // case 2 (and 3) — the session is shared even when the collections are not
      models = createCliFirestoreModels<C, Y>({ binding, session: await requireCliFirestoreSession(context) });
    }

    // delegate to the free functions rather than reimplementing the partition: `{ key, data }` /
    // `{ results, errors }` is the envelope `get-many` and `CliContext.getMultipleModels` both speak,
    // so these stay drop-in and there remains exactly ONE implementation of it
    return {
      ...models,
      readModel: <T = unknown>(modelType: string, key: string) => getModelOverFirestore<T>({ models, modelType, key }),
      readMultipleModels: <T = unknown>(modelType: string, keys: ReadonlyArray<string>) => getMultipleModelsOverFirestore<T>({ models, modelType, keys })
    };
  }

  // Object.assign for the callable-plus-`.binding` intersection, rather than mutating a function
  // through a cast
  return Object.assign(resolve, { binding });
}
