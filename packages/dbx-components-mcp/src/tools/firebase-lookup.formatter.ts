/**
 * Formatter for firebase-model lookups through `dbx_model_lookup`.
 *
 * Brief depth: headline + collapsed field table (no enums, no source).
 * Full depth: everything — identity, parent chain, every field with JSDoc,
 * every declared enum, and the source path for further reading.
 */

import type { FirebaseModel } from '../registry/firebase-models.js';

export type LookupDepth = 'brief' | 'full';

/**
 * Discriminator for the consumer-side store-class shape that pairs with each
 * FIREBASE_MODELS entry. Mirrors the abstract base classes in
 * `@dereekb/dbx-firebase`. The registry today only contains `'root'` and
 * `'sub-collection'`; the singleton / system-state shapes appear in downstream
 * projects (HelloSubs, demo-firebase) and are documented through the
 * `topic="shapes"` taxonomy.
 */
export type FirebaseModelStoreShape = 'root' | 'sub-collection' | 'root-singleton' | 'singleton-sub' | 'system-state';

/**
 * Derives the store-shape for a FIREBASE_MODELS entry. The registry currently
 * exposes only root and sub-collection identities, so this returns one of
 * those two values; richer shapes are documented via the static taxonomy.
 *
 * @param model - A Firebase model registry entry.
 * @returns The shape this model's consumer-side stores follow.
 */
export function firebaseModelStoreShape(model: FirebaseModel): FirebaseModelStoreShape {
  const result: FirebaseModelStoreShape = model.parentIdentityConst ? 'sub-collection' : 'root';
  return result;
}

const STORE_SHAPE_LABEL: Readonly<Record<FirebaseModelStoreShape, string>> = {
  root: 'root',
  'sub-collection': 'sub-collection',
  'root-singleton': 'root-singleton',
  'singleton-sub': 'singleton-sub',
  'system-state': 'system-state'
};

/**
 * Renders a single Firebase model entry as markdown — identity, store shape,
 * source path, and a fields table whose width depends on `depth`.
 *
 * @param model - the registry entry to render
 * @param depth - `'brief'` for fields-only or `'full'` for type/converter columns + enums
 * @returns the markdown body the tool emits as content
 */
export function formatFirebaseModelEntry(model: FirebaseModel, depth: LookupDepth): string {
  const identityLine = model.parentIdentityConst ? `\`${model.identityConst}\` — subcollection of \`${model.parentIdentityConst}\`` : `\`${model.identityConst}\` — root collection`;
  const shape = firebaseModelStoreShape(model);
  const lines: string[] = [`# ${model.name}`, '', `**Identity:** ${identityLine}`, `**Collection:** \`${model.modelType}\` · prefix \`${model.collectionPrefix}\``, `**Store shape:** \`${STORE_SHAPE_LABEL[shape]}\` (see \`dbx_model_lookup topic="shapes"\` for the full taxonomy)`, `**Source:** \`${model.sourceFile}\``, '', `## Fields (${model.fields.length})`, ''];

  if (depth === 'brief') {
    lines.push('| Field | Description |', '|-------|-------------|');
    for (const field of model.fields) {
      const desc = (field.description ?? '–').replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
      lines.push(`| \`${field.name}\` | ${desc} |`);
    }
  } else {
    lines.push('| Field | Description | Type | Converter |', '|-------|-------------|------|-----------|');
    for (const field of model.fields) {
      const desc = (field.description ?? '–').replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
      const ts = field.tsType ? `\`${field.tsType}\`` : '–';
      const conv = `\`${field.converter}\``;
      lines.push(`| \`${field.name}\` | ${desc} | ${ts} | ${conv} |`);
    }

    if (model.enums.length > 0) {
      lines.push('', '## Enums', '');
      for (const en of model.enums) {
        lines.push(`### ${en.name}`, '');
        if (en.description) {
          lines.push(en.description, '');
        }
        for (const value of en.values) {
          const desc = value.description ? ` — ${value.description}` : '';
          lines.push(`- \`${value.name} = ${value.value}\`${desc}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n').trimEnd();
}

/**
 * Renders the catalog view (root vs. subcollection split) so callers can
 * browse the registry before deciding which entry to drill into.
 *
 * @param models - the entries to list, typically the full registry
 * @returns the markdown body the tool emits as content
 */
export function formatFirebaseModelCatalog(models: readonly FirebaseModel[]): string {
  const roots = models.filter((m) => !m.parentIdentityConst);
  const subs = models.filter((m) => m.parentIdentityConst);
  const lines: string[] = [`# Firebase model catalog`, '', `${models.length} models (${roots.length} root, ${subs.length} subcollection).`, '', '## Root collections', ''];
  for (const model of roots) {
    lines.push(`- \`${model.collectionPrefix}\` → **${model.name}** (${model.fields.length} fields)`);
  }
  if (subs.length > 0) {
    lines.push('', '## Subcollections', '');
    for (const model of subs) {
      lines.push(`- \`${model.collectionPrefix}\` → **${model.name}** (under \`${model.parentIdentityConst}\`, ${model.fields.length} fields)`);
    }
  }
  lines.push('', 'Use `dbx_model_lookup topic="<Name>"` or `dbx_model_lookup topic="<prefix>"` for full model details, or `dbx_model_decode` to decode a raw document.', 'See `dbx_model_lookup topic="shapes"` for the consumer-side store-shape taxonomy (root, sub-collection, singletons, system-state).');
  return lines.join('\n').trimEnd();
}

/**
 * Static markdown describing the five consumer-side store-class shapes a
 * Firebase model can take. Surfaces the abstract base classes in
 * `@dereekb/dbx-firebase`, file conventions, and concrete examples — including
 * downstream models (HelloSubs, demo) that aren't in the FIREBASE_MODELS
 * registry but follow the same patterns.
 *
 * @returns A self-contained markdown reference for the shape taxonomy.
 */
export function formatFirebaseStoreShapeTaxonomy(): string {
  return [
    '# Firebase model store shapes',
    '',
    'Five consumer-side store shapes exist for Firestore-backed models. Each maps to one or two abstract base classes in `@dereekb/dbx-firebase`.',
    '',
    '| Shape | Document base | Collection sibling | Parent-bound | Singleton |',
    '|-------|---------------|--------------------|--------------|-----------|',
    '| `root` | `AbstractDbxFirebaseDocumentStore` | `AbstractDbxFirebaseCollectionStore` | no | no |',
    '| `root-singleton` | `AbstractRootSingleItemDbxFirebaseDocument` | typically none | no | yes (single doc identified by `singleItemIdentifier`) |',
    '| `sub-collection` | `AbstractDbxFirebaseDocumentWithParentStore` | `AbstractDbxFirebaseCollectionWithParentStore` | yes | no |',
    '| `singleton-sub` | `AbstractSingleItemDbxFirebaseDocument` | none | yes | yes (one doc per parent) |',
    '| `system-state` | `AbstractSystemStateDocumentStoreAccessor` | none | no | yes (keyed by a `SystemStateTypeIdentifier` constant) |',
    '',
    '## `root`',
    '',
    'Standard Firestore root collection backing a paired document + collection store.',
    '',
    '- **File names:** `<model>.document.store.ts`, `<model>.document.store.directive.ts`, `<model>.collection.store.ts`, `<model>.collection.store.directive.ts`.',
    '- **Collection accessor:** `<modelCamel>Collection` on the firestore-collections class.',
    '- **Document store config:** `super({ firestoreCollection: inject(<Collections>).<modelCamel>Collection });`',
    '- **Examples:** `Profile`, `Job`, `Worker` (HelloSubs), `Guestbook` (demo), `StorageFile`, `NotificationBox` (`@dereekb/firebase`).',
    '',
    '## `root-singleton`',
    '',
    'Single document in a root collection, identified up-front by a fixed `singleItemIdentifier`. Backing collection produced by `makeRootSingleItemFirestoreCollection`.',
    '',
    '- **Base class:** `AbstractRootSingleItemDbxFirebaseDocument<T, D>` — extends the standard root document store but pins the id and disables `setId`/`setKey`.',
    '- **Collection sibling:** typically not emitted (a singleton has nothing to list).',
    '- **Use case:** app-wide config docs, per-deploy registries.',
    '- **No in-scope examples in `@dereekb/firebase` today; downstream projects can use this for app-config singletons.**',
    '',
    '## `sub-collection`',
    '',
    'Standard sub-collection under a parent model — paired document + collection stores, both with `*WithParentStore` bases.',
    '',
    '- **Base classes:** `AbstractDbxFirebaseDocumentWithParentStore<T, P, D, PD>`, `AbstractDbxFirebaseCollectionWithParentStore<T, P, D, PD>`.',
    '- **Document config:** `super({ collectionFactory: <c>.<m>CollectionFactory, firestoreCollectionLike: <c>.<m>CollectionGroup });`',
    '- **Collection config:** `super({ collectionFactory: <c>.<m>CollectionFactory, collectionGroup: <c>.<m>CollectionGroup });`',
    '- **Parent injection:** `@Optional() @Inject(<Parent>DocumentStore) parent` + `if (parent) { this.setParentStore(parent); }`.',
    '- **Examples:** `JobApplication` under `Job`, `WorkerInterview` under `Worker` (HelloSubs); `GuestbookEntry` under `Guestbook` (demo).',
    '',
    '## `singleton-sub`',
    '',
    'One document per parent — typically `<parent>/private/private` or similar fixed-identifier sub-doc. No collection store; listing is meaningless.',
    '',
    '- **Base class:** `AbstractSingleItemDbxFirebaseDocument<T, P, D, PD>` — extends `AbstractDbxFirebaseDocumentWithParentStore` and overrides `setId`/`setKey` to no-ops.',
    '- **Document config:** identical to `sub-collection` (`collectionFactory` + `firestoreCollectionLike`).',
    '- **Parent injection:** identical to `sub-collection`.',
    '- **No paired collection store.** Often no directive either, depending on whether the singleton is consumed at the template level.',
    '- **Examples:** `ProfilePrivate` under `Profile`, `WorkerPrivate` under `Worker`, `WorkerInterviewPrivate` under `WorkerInterview`, `WorkerNote` under `Worker` (all HelloSubs).',
    '',
    '## `system-state`',
    '',
    'Layered convention on top of the central `SystemState` collection — each consumer registers a `SystemStateTypeIdentifier` constant and a typed accessor that wraps the shared `SystemStateDocumentStore`.',
    '',
    '- **Base class:** `AbstractSystemStateDocumentStoreAccessor<TData>` — constructor takes the type identifier; no Firestore-collections injection, no parent, no directive.',
    '- **File suffix:** `.store.accessor.ts` (not `.document.store.ts`).',
    '- **Function helpers:** `firebaseDocumentStoreCreateFunction`, `firebaseDocumentStoreUpdateFunction`, `firebaseDocumentStoreCrudFunction` — all bound to `this.systemStateDocumentStore`.',
    '- **Examples:** `HellosubsCheckHqCompanySystemStateDocumentStoreAccessor`, `HellosubsCheckHqUnclaimedSystemStateDocumentStoreAccessor` (HelloSubs).',
    '',
    '## Picking a shape when scaffolding',
    '',
    '- Backing Firestore identity has a parent? → `sub-collection` for normal sub-docs, `singleton-sub` if the parent has exactly one of these.',
    '- Root identity backed by `makeRootSingleItemFirestoreCollection`? → `root-singleton`.',
    '- No Firestore identity of its own; lives under the central `SystemState` collection keyed by a type constant? → `system-state`.',
    '- Otherwise → `root`.'
  ].join('\n');
}
