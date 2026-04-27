/**
 * `dbx_storagefile_m_list_app` tool.
 *
 * Emits a human-readable report of every `StorageFilePurpose`
 * configured in a downstream `-firebase` component + API app pair.
 * Each entry reports its purpose code, paired
 * `UploadedFileTypeIdentifier`, group-ids helper, processing subtasks,
 * and the two registration flags (`hasUploadInitializer`,
 * `hasProcessingConfig`) so reviewers can see at a glance what's
 * configured and whether it's fully wired.
 *
 * Reuses the cross-file extractor from
 * `dbx_storagefile_m_validate_app` — no duplicate AST walk.
 *
 * Accepts the same `componentDir` + `apiDir` as the validator, plus
 * an optional `format: 'markdown' | 'json'` (default markdown).
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createListAppTool } from './validate-tool.js';
import { inspectAppStorageFiles } from './storagefile-m-validate-app/index.js';
import { formatReportAsJson, formatReportAsMarkdown, listAppStorageFiles } from './storagefile-m-list-app/index.js';

// MARK: Tool definition
const DBX_STORAGEFILE_M_LIST_APP_TOOL: Tool = {
  name: 'dbx_storagefile_m_list_app',
  description: [
    'List every `StorageFilePurpose` configured in a downstream `-firebase` component + API app pair. Each entry reports its purpose code, paired `UploadedFileTypeIdentifier` constant, group-ids helper, declared processing subtasks, and registration flags (`hasUploadInitializer`, `hasProcessingConfig`).',
    '',
    'Cross-file resolution mirrors `dbx_storagefile_m_validate_app` — initializer arrays and spread-of-call factory composition are traced through every `.ts` file under `src/lib/model/storagefile/` on the component side and `src/app/common/model/storagefile/` + `src/app/common/model/notification/` on the API side.',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir', 'apiDir']
  }
};

export const storageFileMListAppTool: DbxTool = createListAppTool({
  definition: DBX_STORAGEFILE_M_LIST_APP_TOOL,
  inspectAndList: async ({ componentAbs, componentRel, apiAbs, apiRel }) => {
    const inspection = await inspectAppStorageFiles(componentAbs, apiAbs);
    return listAppStorageFiles(inspection, { componentDir: componentRel, apiDir: apiRel });
  },
  formatMarkdown: formatReportAsMarkdown,
  formatJson: formatReportAsJson
});
