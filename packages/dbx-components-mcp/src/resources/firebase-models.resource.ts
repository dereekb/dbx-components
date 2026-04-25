/**
 * Firebase Models MCP resources.
 *
 * Exposes the firebase-models registry as read-only resources for clients
 * that prefer browsing registry data over calling tools. Companion to
 * `dbx_model_decode` which consumes the same registry.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getFirebaseModel, getFirebaseModelByPrefix, getFirebaseModels, getFirebasePrefixCatalog, getFirebaseSubcollectionsOf } from '../registry/index.js';

const FIREBASE_MODELS_URI = 'dbx://model/firebase';
const FIREBASE_MODEL_TEMPLATE = 'dbx://model/firebase/{name}';
const FIREBASE_MODELS_BY_PREFIX_TEMPLATE = 'dbx://model/firebase/prefix/{prefix}';
const FIREBASE_SUBCOLLECTIONS_TEMPLATE = 'dbx://model/firebase/subcollections/{parent}';

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
      const result = {
        contents: [
          {
            uri: FIREBASE_MODELS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
      return result;
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
      } else if (!model) {
        const available = getFirebaseModels()
          .map((m) => m.name)
          .join(', ');
        text = `Firebase model '${name}' not found. Available: ${available}`;
      } else {
        text = JSON.stringify(model, null, 2);
      }

      const result = {
        contents: [
          {
            uri: uri.href,
            mimeType: model ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
      return result;
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
      if (!prefix) {
        text = `No prefix supplied. Known prefixes: ${getFirebasePrefixCatalog().join(', ')}`;
      } else {
        const model = getFirebaseModelByPrefix(prefix);
        if (!model) {
          text = `No model uses prefix '${prefix}'. Known prefixes: ${getFirebasePrefixCatalog().join(', ')}`;
        } else {
          text = JSON.stringify({ prefix, model }, null, 2);
          isJson = true;
        }
      }

      const result = {
        contents: [
          {
            uri: uri.href,
            mimeType: isJson ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
      return result;
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
      if (!parent) {
        text = 'No parent identity supplied.';
      } else {
        const subs = getFirebaseSubcollectionsOf(parent);
        text = JSON.stringify({ parent, subcollections: subs }, null, 2);
        isJson = true;
      }

      const result = {
        contents: [
          {
            uri: uri.href,
            mimeType: isJson ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
      return result;
    }
  );
}
