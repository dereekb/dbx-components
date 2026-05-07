/**
 * Firebase Models MCP resources.
 *
 * Exposes the firebase-models registry as read-only resources for clients
 * that prefer browsing registry data over calling tools. Companion to
 * `dbx_model_decode` which consumes the same registry.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FIREBASE_MODELS, getFirebaseModel, getFirebaseModelByPrefix, getFirebaseModels, getFirebasePrefixCatalog, getFirebaseSubcollectionsOf, getFirebaseUserKeyedByIdModels, getFirebaseUserRelatedModels } from '../registry/index.js';
import { buildModelHierarchy } from '../tools/model-hierarchy.formatter.js';

const FIREBASE_MODELS_URI = 'dbx://model/firebase';
const FIREBASE_MODEL_TEMPLATE = 'dbx://model/firebase/{name}';
const FIREBASE_MODELS_BY_PREFIX_TEMPLATE = 'dbx://model/firebase/prefix/{prefix}';
const FIREBASE_SUBCOLLECTIONS_TEMPLATE = 'dbx://model/firebase/subcollections/{parent}';
const FIREBASE_HIERARCHY_URI = 'dbx://model/firebase/hierarchy';
const FIREBASE_HIERARCHY_TEMPLATE = 'dbx://model/firebase/hierarchy/{root}';
const FIREBASE_USER_KEYED_BY_ID_URI = 'dbx://model/firebase/user-keyed-by-id';
const FIREBASE_USER_RELATED_URI = 'dbx://model/firebase/user-related';

/**
 * Registers the Firebase-model MCP resources (catalog, per-name lookup, prefix
 * lookup, subcollection lookup) on the given server. The four URIs together
 * reproduce the `dbx_model_decode` access patterns for browsing clients.
 *
 * @param server - the MCP server to register resources against
 */
export function registerFirebaseModelsResource(server: McpServer): void {
  server.registerResource(
    'dbx-components Firebase Models',
    FIREBASE_MODELS_URI,
    {
      title: 'Firebase Models',
      description: 'Catalog of @dereekb/firebase Firestore models with identity, collection prefix, persisted fields, and declared enums.',
      mimeType: 'application/json'
    },
    async () => {
      const models = getFirebaseModels();
      const payload = {
        description: 'All registered @dereekb/firebase Firestore models.',
        prefixCatalog: getFirebasePrefixCatalog(),
        models: models.map((m) => ({
          name: m.name,
          identityConst: m.identityConst,
          modelType: m.modelType,
          collectionPrefix: m.collectionPrefix,
          parentIdentityConst: m.parentIdentityConst,
          fieldCount: m.fields.length,
          enumCount: m.enums.length,
          sourceFile: m.sourceFile
        }))
      };
      return {
        contents: [
          {
            uri: FIREBASE_MODELS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firebase Model Details',
    new ResourceTemplate(FIREBASE_MODEL_TEMPLATE, { list: undefined }),
    {
      title: 'Firebase Model Details',
      description: 'Full metadata for a single Firebase model by interface name, identity constant, or model type.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawName = variables.name;
      const name = Array.isArray(rawName) ? rawName[0] : rawName;
      const model = name ? getFirebaseModel(name) : undefined;

      let text: string;
      if (!name) {
        text = 'No model name provided.';
      } else if (model) {
        text = JSON.stringify(model, null, 2);
      } else {
        const available = getFirebaseModels()
          .map((m) => m.name)
          .join(', ');
        text = `Firebase model '${name}' not found. Available: ${available}`;
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: model ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firebase Models by Prefix',
    new ResourceTemplate(FIREBASE_MODELS_BY_PREFIX_TEMPLATE, { list: undefined }),
    {
      title: 'Firebase Models by Prefix',
      description: 'Firebase model lookup by collection prefix (e.g. `sf` → StorageFile, `nb` → NotificationBox).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawPrefix = variables.prefix;
      const prefix = Array.isArray(rawPrefix) ? rawPrefix[0] : rawPrefix;

      let text: string;
      let isJson = false;
      if (prefix) {
        const model = getFirebaseModelByPrefix(prefix);
        if (model) {
          text = JSON.stringify({ prefix, model }, null, 2);
          isJson = true;
        } else {
          text = `No model uses prefix '${prefix}'. Known prefixes: ${getFirebasePrefixCatalog().join(', ')}`;
        }
      } else {
        text = `No prefix supplied. Known prefixes: ${getFirebasePrefixCatalog().join(', ')}`;
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: isJson ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firebase Subcollections',
    new ResourceTemplate(FIREBASE_SUBCOLLECTIONS_TEMPLATE, { list: undefined }),
    {
      title: 'Firebase Subcollections',
      description: 'Subcollection models nested under a parent identity (e.g. `notificationBoxIdentity` → Notification, NotificationWeek).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawParent = variables.parent;
      const parent = Array.isArray(rawParent) ? rawParent[0] : rawParent;

      let text: string;
      let isJson = false;
      if (parent) {
        const subs = getFirebaseSubcollectionsOf(parent);
        text = JSON.stringify({ parent, subcollections: subs }, null, 2);
        isJson = true;
      } else {
        text = 'No parent identity supplied.';
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: isJson ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firebase Model Hierarchy',
    FIREBASE_HIERARCHY_URI,
    {
      title: 'Firebase Model Hierarchy',
      description: 'Full upstream model forest assembled from `parentIdentityConst` links. Returns `{ summary, tree, flat }` so browsing clients can pick whichever representation fits.',
      mimeType: 'application/json'
    },
    async () => {
      const hierarchy = buildModelHierarchy({ models: FIREBASE_MODELS, format: 'both' });
      return {
        contents: [
          {
            uri: FIREBASE_HIERARCHY_URI,
            mimeType: 'application/json',
            text: JSON.stringify(hierarchy, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firebase Model Hierarchy Subtree',
    new ResourceTemplate(FIREBASE_HIERARCHY_TEMPLATE, { list: undefined }),
    {
      title: 'Firebase Model Hierarchy Subtree',
      description: 'Subtree rooted at the supplied model (name, identityConst, modelType, or prefix). Same payload shape as the root hierarchy resource.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawRoot = variables.root;
      const root = Array.isArray(rawRoot) ? rawRoot[0] : rawRoot;
      let text: string;
      let mimeType = 'application/json';
      if (!root) {
        text = 'No root model supplied.';
        mimeType = 'text/plain';
      } else {
        const rootModel = getFirebaseModel(root) ?? getFirebaseModelByPrefix(root);
        if (!rootModel) {
          text = `Firebase model '${root}' not found.`;
          mimeType = 'text/plain';
        } else {
          const hierarchy = buildModelHierarchy({ models: FIREBASE_MODELS, rootModel, format: 'both' });
          text = JSON.stringify({ root: rootModel.identityConst, ...hierarchy }, null, 2);
        }
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType,
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firebase User-Keyed Models',
    FIREBASE_USER_KEYED_BY_ID_URI,
    {
      title: 'Firebase User-Keyed Models',
      description: "Models whose Firestore document id IS the user's Firebase Auth uid (interface extends `UserRelatedById`). Useful for enumerating the per-user document set.",
      mimeType: 'application/json'
    },
    async () => {
      const models = getFirebaseUserKeyedByIdModels();
      const payload = {
        description: "Models whose document id IS the user's Firebase Auth uid (extends UserRelatedById).",
        marker: 'UserRelatedById',
        models: models.map((m) => ({
          name: m.name,
          identityConst: m.identityConst,
          modelType: m.modelType,
          collectionPrefix: m.collectionPrefix,
          parentIdentityConst: m.parentIdentityConst,
          sourcePackage: m.sourcePackage,
          sourceFile: m.sourceFile,
          hasUserUidField: m.hasUserUidField === true
        }))
      };
      return {
        contents: [
          {
            uri: FIREBASE_USER_KEYED_BY_ID_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Firebase User-Related Models',
    FIREBASE_USER_RELATED_URI,
    {
      title: 'Firebase User-Related Models',
      description: 'Models that carry an explicit `uid` field referencing a Firebase Auth user (interface extends `UserRelated`).',
      mimeType: 'application/json'
    },
    async () => {
      const models = getFirebaseUserRelatedModels();
      const payload = {
        description: 'Models that carry an explicit `uid` field referencing a Firebase Auth user (extends UserRelated).',
        marker: 'UserRelated',
        models: models.map((m) => ({
          name: m.name,
          identityConst: m.identityConst,
          modelType: m.modelType,
          collectionPrefix: m.collectionPrefix,
          parentIdentityConst: m.parentIdentityConst,
          sourcePackage: m.sourcePackage,
          sourceFile: m.sourceFile,
          userKeyedById: m.userKeyedById === true
        }))
      };
      return {
        contents: [
          {
            uri: FIREBASE_USER_RELATED_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );
}
