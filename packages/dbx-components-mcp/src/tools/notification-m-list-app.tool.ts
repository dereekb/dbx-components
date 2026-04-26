/**
 * `dbx_notification_m_list_app` tool.
 *
 * Emits a human-readable report of every notification template + task
 * configured in a downstream `-firebase` component + API app pair.
 * Each entry reports its type code, metadata, and both registration
 * flags (`inInfoRecord` for templates, `inAllArray`/`inValidateList`/
 * `hasHandler` for tasks) so reviewers can see at a glance what's
 * configured and whether it's fully wired.
 *
 * Reuses the cross-file extractor from
 * `dbx_notification_m_validate_app` — no duplicate AST walk.
 *
 * Accepts the same `componentDir` + `apiDir` as the validator, plus an
 * optional `format: 'markdown' | 'json'` (default markdown).
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createListAppTool } from './validate-tool.js';
import { inspectAppNotifications } from './notification-m-validate-app/index.js';
import { formatReportAsJson, formatReportAsMarkdown, listAppNotifications } from './notification-m-list-app/index.js';

// MARK: Tool definition
const DBX_NOTIFICATION_M_LIST_APP_TOOL: Tool = {
  name: 'dbx_notification_m_list_app',
  description: [
    'List every notification template + notification task configured in a downstream `-firebase` component + API app pair. Each entry reports its type code, metadata (human name, description, notification/target model identity), and registration flags — `inInfoRecord` + `hasFactory` for templates, `inAllArray` + `inValidateList` + `hasHandler` for tasks.',
    '',
    'Cross-file resolution mirrors `dbx_notification_m_validate_app` — spreads and factory composition are traced through every `.ts` file under `src/lib/model/notification/` on the component side and `src/app/common/model/notification/` + `src/app/common/firebase/` on the API side.',
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

export const notificationMListAppTool: DbxTool = createListAppTool({
  definition: DBX_NOTIFICATION_M_LIST_APP_TOOL,
  inspectAndList: async ({ componentAbs, componentRel, apiAbs, apiRel }) => {
    const inspection = await inspectAppNotifications(componentAbs, apiAbs);
    return listAppNotifications(inspection, { componentDir: componentRel, apiDir: apiRel });
  },
  formatMarkdown: formatReportAsMarkdown,
  formatJson: formatReportAsJson
});
