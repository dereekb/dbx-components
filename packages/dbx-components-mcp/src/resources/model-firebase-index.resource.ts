/**
 * Model-firebase-index MCP resources.
 *
 * Exposes the merged firebase-index registry — opted-in via
 * `@dbxModelFirebaseIndex` JSDoc tags across `*.query.ts` files in
 * @dereekb/firebase (plus any downstream packages) — as read-only
 * resources for clients that prefer browsing data over calling
 * `dbx_model_firebase_index_lookup`.
 *
 * Also publishes the static rules reference (composite vs. fieldOverride)
 * and a schema reference for `firestore.indexes.json`.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ModelFirebaseIndexRegistry } from '../registry/model-firebase-index-runtime.js';
import { buildSlugDetailResponse, pickFirstVariable } from './_resource-helpers.js';

const CATALOG_URI = 'dbx://model-firebase-index/entries';
const SCHEMA_URI = 'dbx://model-firebase-index/schema';
const RULES_URI = 'dbx://model-firebase-index/rules';
const TEMPLATE = 'dbx://model-firebase-index/entries/{slug}';
const BY_COLLECTION_TEMPLATE = 'dbx://model-firebase-index/entries/collection/{collection}';
const BY_MODEL_TEMPLATE = 'dbx://model-firebase-index/entries/model/{model}';
const BY_CATEGORY_TEMPLATE = 'dbx://model-firebase-index/entries/category/{category}';
const BY_MODULE_TEMPLATE = 'dbx://model-firebase-index/entries/module/{module}';
const BY_TAG_TEMPLATE = 'dbx://model-firebase-index/entries/tag/{tag}';

const SCHEMA_TEXT = [
  '# `firestore.indexes.json` schema',
  '',
  '**Top-level shape:**',
  '```jsonc',
  '{',
  '  "indexes":        [ /* composite index definitions */ ],',
  '  "fieldOverrides": [ /* per-field single-field index customizations */ ]',
  '}',
  '```',
  '',
  '**`indexes[]` entry (composite indexes):**',
  '- `collectionGroup` (string) — the collection ID (Firestore uses the leaf collection name, e.g. `"jlw"`).',
  '- `queryScope` — `"COLLECTION"` or `"COLLECTION_GROUP"`.',
  '- `fields[]` — ordered list (order matters, mirrors query order):',
  '  - `fieldPath` (string, dot notation supported)',
  '  - one of: `order: "ASCENDING"|"DESCENDING"`, `arrayConfig: "CONTAINS"`, or `vectorConfig`',
  '- `__name__` tiebreaker — every composite the generator emits ends with `{ "fieldPath": "__name__", "order": "ASCENDING" }` (or `DESCENDING` to match the trailing orderBy).',
  '- `density: "SPARSE_ALL"` — emitted on every composite to match the Firebase CLI export shape.',
  '',
  '**`fieldOverrides[]` entry:**',
  '- `{ collectionGroup, fieldPath, ttl?: boolean, indexes: [{ queryScope, order|arrayConfig }] | [] }`',
  '- Empty `indexes: []` disables the auto single-field index for that field.',
  '- The generator emits the four-entry quartet (`ASC COLLECTION`, `DESC COLLECTION`, `CONTAINS COLLECTION`, + the `COLLECTION_GROUP` variant) when adding any `COLLECTION_GROUP` single-field index.'
].join('\n');

const RULES_TEXT = [
  '# When is a composite index required?',
  '',
  '| Query scope | Single-field query | Multi-field query |',
  '|---|---|---|',
  '| `COLLECTION` | **Auto-indexed.** No declaration needed. | **Composite required.** |',
  '| `COLLECTION_GROUP` | **`fieldOverride` required.** Auto single-field indexes are COLLECTION scope only. | **Composite required.** |',
  '',
  '**Every query targeting a nested/subcollection model (i.e. anything queried at COLLECTION_GROUP scope) needs an explicit index entry** — composite if multi-field, fieldOverride if single-field. No silent reliance on automatic indexes.',
  '',
  '**Composite field-order rule:**',
  '',
  '1. Equality (`==`, `in`) fields first.',
  '2. A single range/inequality field.',
  '3. `array-contains` field can appear once.',
  '4. `orderBy` fields last, matching the query order and direction.',
  '5. `__name__` tiebreaker at the end (direction follows last orderBy).'
].join('\n');

/**
 * Input to {@link registerModelFirebaseIndexResource}. The registry is
 * supplied by the server bootstrap after loading the bundled
 * @dereekb/firebase manifest plus any external sources declared in
 * `dbx-mcp.config.json`.
 */
export interface RegisterModelFirebaseIndexResourceOptions {
  readonly registry: ModelFirebaseIndexRegistry;
}

/**
 * Registers the model-firebase-index MCP resources (catalog, per-slug
 * details, collection/model/category/module/tag filters, schema and rules
 * references).
 *
 * @param server - the MCP server to register resources against
 * @param options - registry the resources read from
 */
export function registerModelFirebaseIndexResource(server: McpServer, options: RegisterModelFirebaseIndexResourceOptions): void {
  const { registry } = options;

  server.registerResource(
    'dbx-components Model Firebase Index Entries',
    CATALOG_URI,
    {
      title: 'Model Firebase Index Entries',
      description: 'Catalog of `*.query.ts` factories tagged with @dbxModelFirebaseIndex and the indexes/fieldOverrides each one implies.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'All registered @dbxModelFirebaseIndex factories.',
        collections: registry.collections,
        models: registry.models,
        modules: registry.modules,
        categories: registry.categories,
        entries: registry.all.map((e) => ({
          slug: e.slug,
          name: e.name,
          module: e.module,
          subpath: e.subpath,
          model: e.model,
          collection: e.collection,
          scope: e.scope,
          isNested: e.isNested,
          skip: e.skip,
          manual: e.manual,
          category: e.category,
          tags: e.tags,
          compositeCount: e.derivedComposites.length,
          fieldOverrideCount: e.derivedFieldOverrides.length
        }))
      };
      return {
        contents: [
          {
            uri: CATALOG_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Firebase Index Entry Details',
    new ResourceTemplate(TEMPLATE, { list: undefined }),
    {
      title: 'Model Firebase Index Entry Details',
      description: 'Full metadata for a single firebase-index entry by slug, including derived composite + fieldOverride contributions.',
      mimeType: 'application/json'
    },
    async (uri, variables) =>
      buildSlugDetailResponse({
        uri,
        rawSlug: variables.slug,
        resolveEntry: (slug) => registry.findBySlug(slug),
        listAvailableSlugs: () => registry.all.map((e) => e.slug),
        label: 'Model firebase index'
      })
  );

  server.registerResource(
    'dbx-components Model Firebase Index Entries by Collection',
    new ResourceTemplate(BY_COLLECTION_TEMPLATE, { list: undefined }),
    {
      title: 'Model Firebase Index Entries by Collection',
      description: 'Firebase-index entries filtered by short collection name (e.g. `jlw`, `jlja`).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const collection = pickFirstVariable(variables.collection);
      let text: string;
      let valid = false;
      if (collection !== undefined && registry.collections.includes(collection)) {
        valid = true;
        const entries = registry.findByCollection(collection);
        text = JSON.stringify({ collection, entries }, null, 2);
      } else {
        text = `Invalid collection. Valid values: ${registry.collections.join(', ')}`;
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Firebase Index Entries by Model',
    new ResourceTemplate(BY_MODEL_TEMPLATE, { list: undefined }),
    {
      title: 'Model Firebase Index Entries by Model',
      description: 'Firebase-index entries filtered by target TS model name (e.g. `JobLocationWeek`).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const model = pickFirstVariable(variables.model);
      let text: string;
      let valid = false;
      if (model !== undefined && registry.models.includes(model)) {
        valid = true;
        const entries = registry.findByModel(model);
        text = JSON.stringify({ model, entries }, null, 2);
      } else {
        text = `Invalid model. Valid values: ${registry.models.join(', ')}`;
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Firebase Index Entries by Category',
    new ResourceTemplate(BY_CATEGORY_TEMPLATE, { list: undefined }),
    {
      title: 'Model Firebase Index Entries by Category',
      description: 'Firebase-index entries filtered by category (e.g. `sync`, `dirty`).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const category = pickFirstVariable(variables.category);
      let text: string;
      let valid = false;
      if (category !== undefined && registry.categories.includes(category)) {
        valid = true;
        const entries = registry.findByCategory(category);
        text = JSON.stringify({ category, entries }, null, 2);
      } else {
        text = `Invalid category. Valid values: ${registry.categories.join(', ')}`;
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Firebase Index Entries by Module',
    new ResourceTemplate(BY_MODULE_TEMPLATE, { list: undefined }),
    {
      title: 'Model Firebase Index Entries by Module',
      description: 'Firebase-index entries filtered by npm module (e.g. `@dereekb/firebase`).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const module = pickFirstVariable(variables.module);
      let text: string;
      let valid = false;
      if (module !== undefined && registry.modules.includes(module)) {
        valid = true;
        const entries = registry.findByModule(module);
        text = JSON.stringify({ module, entries }, null, 2);
      } else {
        text = `Invalid module. Valid values: ${registry.modules.join(', ')}`;
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Firebase Index Entries by Tag',
    new ResourceTemplate(BY_TAG_TEMPLATE, { list: undefined }),
    {
      title: 'Model Firebase Index Entries by Tag',
      description: 'Firebase-index entries filtered by tag (case-insensitive).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const tag = pickFirstVariable(variables.tag);
      let text: string;
      let valid = false;
      if (tag !== undefined && tag.length > 0) {
        valid = true;
        const entries = registry.findByTag(tag);
        text = JSON.stringify({ tag, entries }, null, 2);
      } else {
        text = 'No tag provided.';
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firestore Indexes Schema Reference',
    SCHEMA_URI,
    {
      title: 'firestore.indexes.json Schema Reference',
      description: 'Top-level shape of firestore.indexes.json (composites + fieldOverrides).',
      mimeType: 'text/markdown'
    },
    async () => ({
      contents: [
        {
          uri: SCHEMA_URI,
          mimeType: 'text/markdown',
          text: SCHEMA_TEXT
        }
      ]
    })
  );

  server.registerResource(
    'dbx-components Firestore Indexes Rules Reference',
    RULES_URI,
    {
      title: 'firestore.indexes.json Rules Reference',
      description: 'Composite-vs-fieldOverride rules and the composite field-order rule.',
      mimeType: 'text/markdown'
    },
    async () => ({
      contents: [
        {
          uri: RULES_URI,
          mimeType: 'text/markdown',
          text: RULES_TEXT
        }
      ]
    })
  );
}
