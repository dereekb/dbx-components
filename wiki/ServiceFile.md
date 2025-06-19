# The `service.ts` Aggregator – Building **DemoFirebaseContext**

Every individual model defines its own collections and permission logic, but the application needs a **single place** that:

1. **Composes** all those per-model pieces.  
2. **Exposes** strongly-typed helpers to the rest of the codebase (Angular app, Cloud Functions, tests).  
3. **Centralises** permission mapping so we can ask, *“Does user X have role Y for document Z?”* without knowing which model Z belongs to.

That place is `components/demo-firebase/src/lib/model/service.ts`.

---

## 1. `DemoFirestoreCollections` interface
```ts
export abstract class DemoFirestoreCollections implements
  FirestoreContextReference,
  SystemStateFirestoreCollections,
  GuestbookFirestoreCollections,
  ProfileFirestoreCollections,
  NotificationFirestoreCollections {
  // one readonly property per collection / factory / group
}
```

• It **extends** the `<Model>FirestoreCollections` interface exported by each model (see `Models.md`).  
• The concrete implementation is returned by `makeDemoFirestoreCollections(firestoreContext)`; now every collection is available via `ctx.app.*`.

---

## 2. `firebaseModelServiceFactory` per model
For each model we call `firebaseModelServiceFactory` to create a **Model Service** – a wrapper around:
* Loader functions (`get`, `query`…)  
* Permission checks / role maps  
* Caching & convenience helpers

Example for `Profile`:
```ts
export const profileFirebaseModelServiceFactory = firebaseModelServiceFactory<
  DemoFirebaseContext,
  Profile,
  ProfileDocument,
  ProfileRoles
>({
  roleMapForModel: (output, ctx, model) =>
    grantFullAccessIfAuthUserRelated(model, ctx),
  getFirestoreCollection: (c) => c.app.profileCollection,
});
```
The factory is **pure** (no side-effects). It is later memoised by the generated service layer.

---

## 3. `DEMO_FIREBASE_MODEL_SERVICE_FACTORIES` & `demoFirebaseModelServices`
```ts
export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  systemState: systemStateFirebaseModelServiceFactory,
  guestbook: guestbookFirebaseModelServiceFactory,
  guestbookEntry: guestbookEntryFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profilePrivate: profilePrivateDataFirebaseModelServiceFactory,
  // …notification factories…
};

export const demoFirebaseModelServices = firebaseModelsService(
  DEMO_FIREBASE_MODEL_SERVICE_FACTORIES
);
```
`firebaseModelsService()` takes the factory map and returns a **lazy-loaded** object whose keys mirror the map. Each property:
* Instantiates the underlying model service on first access.  
* Caches it for subsequent use.

---

## 4. `DemoFirebaseContext`
```ts
export type DemoFirebaseContext = FirebaseAppModelContext<DemoFirestoreCollections>
  & { service: DemoFirebaseModelServiceFactories };
```
This context is threaded through the entire application (including Cloud Functions). Within any function you can now do:
```ts
const profileDoc = await ctx.service.profile.loadModelForKey(profileKey);
```
and get fully-typed data plus permission helpers – all without importing the raw collections directly.

---

## Why this matters
1. **Single point of truth** – add or refactor a model in one place; every consumer updates automatically via TypeScript types.
2. **Tree-shaking friendly** – factories are lazy, so importing `DemoFirebaseContext` does not pull in every model unless you use it.
3. **Testability** – swap factories with mocks/stubs in unit tests by providing an alternate context implementation.

---

## Creating a new model – service layer steps
1. Export `<NewModel>FirestoreCollections` & `<NewModel>Types` from the model file.  
2. Write a `<newModel>FirebaseModelServiceFactory` in `service.ts` (copy an existing one).  
3. Add the factory to `DEMO_FIREBASE_MODEL_SERVICE_FACTORIES`.  
4. Add the collections to `DemoFirestoreCollections` & its builder.

With that, the new model is available everywhere through `ctx.service.<name>` and `ctx.app.<collection>` ✨
