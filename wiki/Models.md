# Anatomy of a Firestore **Model** (`demo-firebase`)

This document explains the three files that make up every model in the **shared** `components/demo-firebase` library and why they are split.
All runtimes (Angular app, Cloud Functions, NestJS, tests) import *exactly* the same definitions so that **data-layer code lives in one place**.

<table>
<tr><th>File</th><th>Purpose</th></tr>
<tr><td><code>profile.id.ts</code></td><td>Lightweight *type* aliases (<code>ProfileId</code>, <code>ProfileKey</code>). Never imports the full model file; safe for low-level utilities that must avoid circular deps.</td></tr>
<tr><td><code>profile.ts</code></td><td>Full document declaration and Firestore helpers (identity, interface, converter, collection factories, etc.). Used by anything that reads/writes data.</td></tr>
<tr><td><code>profile.api.ts</code></td><td>Parameter/return types + config maps for Cloud Functions (aka “Model CRUD Functions”). Consumed by both the server implementation and the client SDK.</td></tr>
</table>

---

## 1. <code>profile.id.ts</code> – **Id & Key types only**
```ts
import { FirebaseAuthUserId, FirestoreModelKey } from '@dereekb/firebase';

export type ProfileKey = FirestoreModelKey;   // short-hand for document key
export type ProfileId  = FirebaseAuthUserId;  // UID of the owning auth user
```
Why a separate file?
* Other core libraries (auth, analytics, etc.) often need to refer to “ProfileId” but **do not need** the rest of the model.
* Placing it in its own file prevents accidental circular imports (e.g. auth → profile → auth).

Rule of thumb: **Id/Key types go in their own `.id.ts` file; everything else stays in `.ts`.**

---

## 2. <code>profile.ts</code> – **Document definition & Firestore helpers**
This is the heart of the model. Key sections:

1. **Identity**
   ```ts
   export const profileIdentity = firestoreModelIdentity('profile', 'pr');
   ```
   *Unique* collection name (`profile`) + two-letter prefix (`pr`). Child identities may be derived from it.

2. **TypeScript interface** – pure data
   ```ts
   export interface Profile extends UserRelated {
     username: string;
     bio?: Maybe<string>;
     updatedAt: Date;
   }
   ```

3. **Converter** – run-time schema & defaults
   ```ts
   export const profileConverter = snapshotConverterFunctions<Profile>({
     fields: {
       uid: firestoreUID(),
       username: firestoreString({ default: '' }),
       bio: optionalFirestoreString(),
       updatedAt: firestoreDate({ saveDefaultAsNow: true })
     }
   });
   ```
   Handles (de)serialisation between Firestore and TypeScript.

4. **Document class** – thin wrapper
   ```ts
   export class ProfileDocument extends AbstractFirestoreDocument<Profile, ...> {
     get modelIdentity() { return profileIdentity; }
   }
   ```

5. **Collection factory** – strongly typed helper available everywhere
   ```ts
   export function profileFirestoreCollection(ctx: FirestoreContext) {
     return ctx.firestoreCollection({ ... });
   }
   ```
   * Provides `get`, `set`, `query`, etc., all fully typed.

6. **Sub-collections & collection groups**
   Demonstrated with `ProfilePrivateData` – shows how to nest additional data under a document.

Together, these pieces give you IDE autocompletion and compile-time safety for every Firestore operation.

---

## 3. <code>profile.api.ts</code> – **Cloud Function type map**
The project uses a *typed* wrapper around Firebase callable functions. Each model gets its own map:

```ts
export const profileSetUsernameKey = 'profileSetUsername';

type ProfileFunctionTypeMap = {
  [profileSetUsernameKey]: [SetProfileUsernameParams, void];
};

export const profileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ProfileFunctionTypeMap> = {
  [profileSetUsernameKey]: null
};
```

Why keep it separate?
* Server code needs the parameter classes (<code>class-validator</code> decorators, etc.) **but not** the client-side interfaces.
* The client SDK imports this file to gain compile-time safety when calling <code>httpsCallable()</code> wrappers.

`ModelFirebaseCrudFunctionConfigMap` at the bottom generates **CRUD shortcuts** (e.g. `profile.update.username`).
These names become callable functions on the server and IDE-discoverable methods on the client – all with the correct types.

---

## 4. Shared collection helpers (`ProfileFirestoreCollections`) and union type (`ProfileTypes`)

Two *extra* exports appear at the bottom of every model file; they are consumed by the **service.ts** aggregator (see `ServiceFile.md`).

```ts
export interface ProfileFirestoreCollections {
  profileCollection: ProfileFirestoreCollection;
  profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
  profilePrivateDataCollectionGroup: ProfilePrivateDataFirestoreCollectionGroup;
}

export type ProfileTypes = typeof profileIdentity | typeof profilePrivateDataIdentity;
```

Why are they useful?

1. **ProfileFirestoreCollections**
   * Acts like a typed *manifest* of every collection (or factory/collection-group) that belongs to the model.
   * The top-level `DemoFirestoreCollections` interface & implementation (`service.ts`) *merge* these per-model interfaces into a single object that the rest of the app can depend on. Every collection becomes available as `context.app.<collectionName>` with correct types.

2. **ProfileTypes**
   * Union of all `firestoreModelIdentity` objects belonging to the model (parent + any sub-collections).
   * Lets generic helpers (permissions, services, tests) operate on **“any Profile-related document”** without referencing each identity individually.

Pattern: every new model should export `<Model>FirestoreCollections` and `<Model>Types` so the service layer can pick them up automatically.

---

## Putting it together
1. **Components that only need an id** → import from `.id.ts`.
2. **Anything that reads/writes the document** → import from `.ts` (the full model).
3. **Cloud Functions (client or server)** → import from `.api.ts` for parameter and return types.

Following this split keeps each dependency graph minimal and prevents circular imports as your codebase grows.

---

## Creating a new model checklist
1. **`<model>.id.ts`** – `ModelId`, `ModelKey` aliases.
2. **`<model>.ts`** – identity, interface, converter, document, collection(s).
3. **`<model>.api.ts`** – parameter classes, function type maps, CRUD config.

Copy the `Profile` trio, rename, adjust field definitions and you’re done! 🚀
