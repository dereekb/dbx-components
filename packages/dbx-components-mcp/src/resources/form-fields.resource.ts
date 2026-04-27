/**
 * Form Fields MCP resources.
 *
 * Exposes the form field registry as read-only resources for clients that
 * prefer browsing data over calling tools. Built around a
 * {@link ForgeFieldRegistry} loaded at server startup; tests can drive it via
 * {@link createForgeFieldRegistryFromEntries}.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FORM_TIER_ORDER, type FormTier, type FormArrayOutput } from '../registry/index.js';
import type { ForgeFieldRegistry } from '../registry/forge-fields.js';

const FORM_FIELDS_URI = 'dbx://form/fields';
const FORM_FIELD_TEMPLATE = 'dbx://form/fields/{slug}';
const FORM_FIELDS_BY_PRODUCES_TEMPLATE = 'dbx://form/fields/produces/{produces}';
const FORM_FIELDS_BY_TIER_TEMPLATE = 'dbx://form/fields/tier/{tier}';
const FORM_FIELDS_BY_ARRAY_OUTPUT_TEMPLATE = 'dbx://form/fields/array-output/{arrayOutput}';
const ARRAY_OUTPUT_VALUES: readonly FormArrayOutput[] = ['yes', 'no', 'optional'];

/**
 * Configuration for {@link registerFormFieldsResource}.
 */
export interface RegisterFormFieldsResourceConfig {
  readonly registry: ForgeFieldRegistry;
}

/**
 * Registers the form-field MCP resources (catalog, per-slug details, plus
 * filtered views by produces/tier/array-output) on the given server. The
 * separate URIs reflect the same primary indexes that the lookup tools use.
 *
 * @param server - the MCP server to register resources against
 * @param config - registry the resources should read from
 */
export function registerFormFieldsResource(server: McpServer, config: RegisterFormFieldsResourceConfig): void {
  const { registry } = config;

  server.registerResource(
    'dbx-components Form Fields',
    FORM_FIELDS_URI,
    {
      title: 'Form Fields',
      description: 'Catalog of all @dereekb/dbx-form field factories with config interfaces and value types.',
      mimeType: 'application/json'
    },
    async () => {
      const fields = registry.all;
      const payload = {
        description: 'All registered @dereekb/dbx-form entries (factories, derivatives, composite builders, template builders, primitives).',
        tierOrder: FORM_TIER_ORDER,
        producesCatalog: registry.producesCatalog,
        fields: fields.map((f) => ({
          slug: f.slug,
          factoryName: f.factoryName,
          tier: f.tier,
          produces: f.produces,
          arrayOutput: f.arrayOutput,
          description: f.description
        }))
      };
      return {
        contents: [
          {
            uri: FORM_FIELDS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Form Field Details',
    new ResourceTemplate(FORM_FIELD_TEMPLATE, { list: undefined }),
    {
      title: 'Form Field Details',
      description: 'Full metadata for a single form field factory by slug or factory name.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const slugValue = variables.slug;
      const slug = Array.isArray(slugValue) ? slugValue[0] : slugValue;
      const field = slug ? (registry.findBySlug(slug) ?? registry.findByFactoryName(slug)) : undefined;

      let text: string;
      if (slug && field) {
        text = JSON.stringify(field, null, 2);
      } else if (slug) {
        const available = registry.all.map((f) => f.slug).join(', ');
        text = `Form field '${slug}' not found. Available slugs: ${available}`;
      } else {
        text = 'No slug provided.';
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: field ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Form Fields by Produces',
    new ResourceTemplate(FORM_FIELDS_BY_PRODUCES_TEMPLATE, { list: undefined }),
    {
      title: 'Form Fields by Produces',
      description: 'Form entries filtered by the output primitive they produce (e.g. `string`, `Date`, `RowField`).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const producesValue = variables.produces;
      const produces = Array.isArray(producesValue) ? producesValue[0] : producesValue;

      let text: string;
      let isJson = false;
      if (produces) {
        const entries = registry.findByProduces(produces);
        if (entries.length === 0) {
          text = `No form entries produce '${produces}'. Known values: ${registry.producesCatalog.join(', ')}`;
        } else {
          text = JSON.stringify({ produces, fields: entries }, null, 2);
          isJson = true;
        }
      } else {
        text = `No produces value supplied. Known values: ${registry.producesCatalog.join(', ')}`;
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
    'dbx-components Form Fields by Tier',
    new ResourceTemplate(FORM_FIELDS_BY_TIER_TEMPLATE, { list: undefined }),
    {
      title: 'Form Fields by Tier',
      description: 'Form entries filtered by builder tier (field-factory, field-derivative, composite-builder, template-builder, primitive).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const tierValue = variables.tier;
      const tier = (Array.isArray(tierValue) ? tierValue[0] : tierValue) as FormTier | undefined;

      const valid = tier && FORM_TIER_ORDER.includes(tier);
      let text: string;
      if (valid) {
        const entries = registry.findByTier(tier);
        text = JSON.stringify({ tier, fields: entries }, null, 2);
      } else {
        text = `Invalid tier. Valid values: ${FORM_TIER_ORDER.join(', ')}`;
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
    'dbx-components Form Fields by Array Output',
    new ResourceTemplate(FORM_FIELDS_BY_ARRAY_OUTPUT_TEMPLATE, { list: undefined }),
    {
      title: 'Form Fields by Array Output',
      description: "Form entries filtered by whether their output is an array ('yes'), single value ('no'), or configurable ('optional').",
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const value = variables.arrayOutput;
      const arrayOutput = (Array.isArray(value) ? value[0] : value) as FormArrayOutput | undefined;

      const valid = arrayOutput && ARRAY_OUTPUT_VALUES.includes(arrayOutput);
      let text: string;
      if (valid) {
        const entries = registry.findByArrayOutput(arrayOutput);
        text = JSON.stringify({ arrayOutput, fields: entries }, null, 2);
      } else {
        text = `Invalid arrayOutput value. Valid values: ${ARRAY_OUTPUT_VALUES.join(', ')}`;
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
}
