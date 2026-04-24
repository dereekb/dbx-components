/**
 * Forge Fields MCP resources.
 *
 * Exposes the forge field registry as read-only resources for clients that
 * prefer browsing data over calling tools.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getForgeFields, getForgeField, getForgeFieldsByProduces, getForgeFieldsByTier, getForgeProducesCatalog, FORGE_TIER_ORDER, type ForgeTier } from '../registry/index.js';

const FORGE_FIELDS_URI = 'dbx://forge-fields';
const FORGE_FIELD_TEMPLATE = 'dbx://forge-fields/{slug}';
const FORGE_FIELDS_BY_PRODUCES_TEMPLATE = 'dbx://forge-fields/produces/{produces}';
const FORGE_FIELDS_BY_TIER_TEMPLATE = 'dbx://forge-fields/tier/{tier}';

export function registerForgeFieldsResource(server: McpServer): void {
  server.registerResource(
    'dbx-components Forge Fields',
    FORGE_FIELDS_URI,
    {
      title: 'Forge Fields',
      description: 'Catalog of all @dereekb/dbx-form forge field factories with config interfaces and value types.',
      mimeType: 'application/json'
    },
    async () => {
      const fields = getForgeFields();
      const payload = {
        description: 'All registered @dereekb/dbx-form forge entries (factories, composite builders, primitives).',
        tierOrder: FORGE_TIER_ORDER,
        producesCatalog: getForgeProducesCatalog(),
        fields: fields.map((f) => ({
          slug: f.slug,
          factoryName: f.factoryName,
          tier: f.tier,
          produces: f.produces,
          arrayOutput: f.arrayOutput,
          description: f.description
        }))
      };
      const result = {
        contents: [
          {
            uri: FORGE_FIELDS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
      return result;
    }
  );

  server.registerResource(
    'dbx-components Forge Field Details',
    new ResourceTemplate(FORGE_FIELD_TEMPLATE, { list: undefined }),
    {
      title: 'Forge Field Details',
      description: 'Full metadata for a single forge field factory by slug or factory name.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const slugValue = variables.slug;
      const slug = Array.isArray(slugValue) ? slugValue[0] : slugValue;
      const field = slug ? getForgeField(slug) : undefined;

      let text: string;
      if (!slug) {
        text = 'No slug provided.';
      } else if (!field) {
        const available = getForgeFields()
          .map((f) => f.slug)
          .join(', ');
        text = `Forge field '${slug}' not found. Available slugs: ${available}`;
      } else {
        text = JSON.stringify(field, null, 2);
      }

      const result = {
        contents: [
          {
            uri: uri.href,
            mimeType: field ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
      return result;
    }
  );

  server.registerResource(
    'dbx-components Forge Fields by Produces',
    new ResourceTemplate(FORGE_FIELDS_BY_PRODUCES_TEMPLATE, { list: undefined }),
    {
      title: 'Forge Fields by Produces',
      description: 'Forge entries filtered by the output primitive they produce (e.g. `string`, `Date`, `RowField`).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const producesValue = variables.produces;
      const produces = Array.isArray(producesValue) ? producesValue[0] : producesValue;

      let text: string;
      let isJson = false;
      if (!produces) {
        text = `No produces value supplied. Known values: ${getForgeProducesCatalog().join(', ')}`;
      } else {
        const entries = getForgeFieldsByProduces(produces);
        if (entries.length === 0) {
          text = `No forge entries produce '${produces}'. Known values: ${getForgeProducesCatalog().join(', ')}`;
        } else {
          text = JSON.stringify({ produces, fields: entries }, null, 2);
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
    'dbx-components Forge Fields by Tier',
    new ResourceTemplate(FORGE_FIELDS_BY_TIER_TEMPLATE, { list: undefined }),
    {
      title: 'Forge Fields by Tier',
      description: 'Forge entries filtered by builder tier (field-factory, composite-builder, primitive).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const tierValue = variables.tier;
      const tier = (Array.isArray(tierValue) ? tierValue[0] : tierValue) as ForgeTier | undefined;

      const valid = tier && FORGE_TIER_ORDER.includes(tier);
      let text: string;
      if (!valid) {
        text = `Invalid tier. Valid values: ${FORGE_TIER_ORDER.join(', ')}`;
      } else {
        const entries = getForgeFieldsByTier(tier);
        text = JSON.stringify({ tier, fields: entries }, null, 2);
      }

      const result = {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
      return result;
    }
  );
}
