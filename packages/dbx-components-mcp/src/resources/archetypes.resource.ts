/**
 * Model archetype MCP resources.
 *
 * Exposes the {@link MODEL_ARCHETYPES} catalog as read-only resources for
 * clients that prefer browsing data over calling `dbx_model_archetype_lookup`.
 *
 * Registered URIs:
 *   - `dbx://model-archetype/entries` — full catalog
 *   - `dbx://model-archetype/entries/{slug}` — single archetype JSON
 *   - `dbx://model-archetype/by-sync-mode/{mode}` — filter by sync mode
 *   - `dbx://model-archetype/by-axis/{axisName}/{axisValue}` — axis filter
 *   - `dbx://model-archetype/by-collection-kind/{kind}` — filter by implied `FirestoreCollectionKind`
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MODEL_ARCHETYPES, MODEL_ARCHETYPE_SYNC_MODES, getModelArchetypeBySlug, getModelArchetypesByCollectionKind, getModelArchetypesBySyncMode, getModelArchetypesByAxisValue, resolveModelArchetype, type ModelArchetypeSyncMode, type ModelArchetypeSlug } from '../registry/archetypes.js';
import type { FirestoreCollectionKind } from '../registry/firebase-models.js';

const ARCHETYPES_URI = 'dbx://model-archetype/entries';
const ARCHETYPE_TEMPLATE = 'dbx://model-archetype/entries/{slug}';
const ARCHETYPES_BY_SYNC_MODE_TEMPLATE = 'dbx://model-archetype/by-sync-mode/{mode}';
const ARCHETYPES_BY_AXIS_TEMPLATE = 'dbx://model-archetype/by-axis/{axisName}/{axisValue}';
const ARCHETYPES_BY_COLLECTION_KIND_TEMPLATE = 'dbx://model-archetype/by-collection-kind/{kind}';

/**
 * Registers the model-archetype resource family. No registry argument because
 * the catalog is a static constant.
 *
 * @param server - The MCP server to register resources against.
 */
export function registerModelArchetypesResource(server: McpServer): void {
  server.registerResource(
    'dbx-components Model Archetype Entries',
    ARCHETYPES_URI,
    {
      title: 'Model Archetype Entries',
      description: 'Catalog of Firestore-model archetypes with declared axes and implied `collectionKind`.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'All registered Firestore-model archetypes.',
        syncModes: MODEL_ARCHETYPE_SYNC_MODES,
        archetypes: MODEL_ARCHETYPES.map((a) => ({
          slug: a.slug,
          family: a.family,
          collectionKind: a.collectionKind,
          description: a.description,
          whenToUse: a.whenToUse,
          extensionCluster: a.extensionCluster,
          axes: a.axes,
          disambiguation: a.disambiguation
        }))
      };
      return {
        contents: [
          {
            uri: ARCHETYPES_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Archetype Details',
    new ResourceTemplate(ARCHETYPE_TEMPLATE, { list: undefined }),
    {
      title: 'Model Archetype Details',
      description: 'Full metadata for a single archetype by slug.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const raw = variables.slug;
      const slug = Array.isArray(raw) ? raw[0] : raw;
      let text: string;
      let mimeType = 'application/json';
      if (slug) {
        const direct = getModelArchetypeBySlug(slug as ModelArchetypeSlug);
        const resolved = direct ?? resolveModelArchetype(slug)?.archetype;
        if (resolved) {
          text = JSON.stringify(resolved, null, 2);
        } else {
          text = `Archetype '${slug}' not found. Try \`dbx://model-archetype/entries\` for the catalog.`;
          mimeType = 'text/plain';
        }
      } else {
        text = 'No slug supplied.';
        mimeType = 'text/plain';
      }
      return { contents: [{ uri: uri.href, mimeType, text }] };
    }
  );

  server.registerResource(
    'dbx-components Model Archetypes by Sync Mode',
    new ResourceTemplate(ARCHETYPES_BY_SYNC_MODE_TEMPLATE, { list: undefined }),
    {
      title: 'Model Archetypes by Sync Mode',
      description: 'Filter archetypes by their declared sync mode (always-in-sync, trigger-eventual, flag-eventual, …).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawMode = variables.mode;
      const mode = (Array.isArray(rawMode) ? rawMode[0] : rawMode) as ModelArchetypeSyncMode | undefined;
      let text: string;
      let mimeType = 'application/json';
      if (mode && MODEL_ARCHETYPE_SYNC_MODES.includes(mode)) {
        const matches = getModelArchetypesBySyncMode(mode);
        text = JSON.stringify({ mode, archetypes: matches }, null, 2);
      } else {
        text = `Unknown sync mode '${String(mode)}'. Known modes: ${MODEL_ARCHETYPE_SYNC_MODES.join(', ')}.`;
        mimeType = 'text/plain';
      }
      return { contents: [{ uri: uri.href, mimeType, text }] };
    }
  );

  server.registerResource(
    'dbx-components Model Archetypes by Axis',
    new ResourceTemplate(ARCHETYPES_BY_AXIS_TEMPLATE, { list: undefined }),
    {
      title: 'Model Archetypes by Axis',
      description: 'Filter archetypes by axis value (e.g. by-axis/subPurpose/private).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawAxis = variables.axisName;
      const rawValue = variables.axisValue;
      const axisName = Array.isArray(rawAxis) ? rawAxis[0] : rawAxis;
      const axisValue = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      let text: string;
      let mimeType = 'application/json';
      if (axisName && axisValue) {
        const matches = getModelArchetypesByAxisValue(axisName, axisValue);
        text = JSON.stringify({ axisName, axisValue, archetypes: matches }, null, 2);
      } else {
        text = 'Both axisName and axisValue must be supplied.';
        mimeType = 'text/plain';
      }
      return { contents: [{ uri: uri.href, mimeType, text }] };
    }
  );

  server.registerResource(
    'dbx-components Model Archetypes by Collection Kind',
    new ResourceTemplate(ARCHETYPES_BY_COLLECTION_KIND_TEMPLATE, { list: undefined }),
    {
      title: 'Model Archetypes by Collection Kind',
      description: 'Filter archetypes by their implied `FirestoreCollectionKind` (root, root-singleton, sub-collection, singleton-sub).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const raw = variables.kind;
      const kind = (Array.isArray(raw) ? raw[0] : raw) as FirestoreCollectionKind | undefined;
      let text: string;
      let mimeType = 'application/json';
      const knownKinds: readonly FirestoreCollectionKind[] = ['root', 'root-singleton', 'sub-collection', 'singleton-sub'];
      if (kind && knownKinds.includes(kind)) {
        const matches = getModelArchetypesByCollectionKind(kind);
        text = JSON.stringify({ kind, archetypes: matches }, null, 2);
      } else {
        text = `Unknown collection kind '${String(kind)}'. Known kinds: ${knownKinds.join(', ')}.`;
        mimeType = 'text/plain';
      }
      return { contents: [{ uri: uri.href, mimeType, text }] };
    }
  );
}
