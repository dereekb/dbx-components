/**
 * `dbx_asset_list_app` tool.
 *
 * Emits a flat per-asset summary of every `AssetPathRef` constant
 * declared in a downstream `-firebase` component package, plus the
 * declared `AssetPathRef[]` aggregator(s), plus three setup flags
 * (assets file present, barrel re-exports, provider wired). Reuses the
 * cross-file extractor from `dbx_asset_validate_app` — no duplicate
 * AST walk.
 *
 * Accepts the same `componentDir` + `apiDir` as the validator, plus an
 * optional `format: 'markdown' | 'json'` (default markdown).
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createListAppTool } from './validate-tool.js';
import { inspectAppAssets } from './dbx-asset-validate-app/index.js';
import { formatReportAsJson, formatReportAsMarkdown, listAppAssets } from './dbx-asset-list-app/index.js';

const DBX_ASSET_LIST_APP_TOOL: Tool = {
  name: 'dbx_asset_list_app',
  description: [
    'List every `AssetPathRef` constant declared in a downstream `-firebase` component + Angular app pair. Each entry reports its symbol name, source type (local / remote), builder used, statically resolved path/url, and source file:line. Aggregator exports (`AssetPathRef[]`) are listed separately with their member identifiers.',
    '',
    'Cross-file resolution mirrors `dbx_asset_validate_app` — `assetFolder` and `remoteAssetBaseUrl` builder bindings are followed back to their string arguments to produce the joined path/url.',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the Angular app (e.g. `apps/demo`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      apiDir: { type: 'string', description: 'Relative path to the Angular app.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir', 'apiDir']
  }
};

export const dbxAssetListAppTool: DbxTool = createListAppTool({
  definition: DBX_ASSET_LIST_APP_TOOL,
  inspectAndList: async ({ componentAbs, componentRel, apiAbs, apiRel }) => {
    const inspection = await inspectAppAssets(componentAbs, apiAbs);
    return listAppAssets(inspection, { componentDir: componentRel, apiDir: apiRel });
  },
  formatMarkdown: formatReportAsMarkdown,
  formatJson: formatReportAsJson
});
