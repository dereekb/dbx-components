/**
 * `dbx_notification_m_validate_app` tool.
 *
 * Cross-file verifier for downstream app notifications. Reads the
 * component package's `src/lib/model/notification/` and the API app's
 * `src/app/common/model/notification/`, then asserts every declared
 * `NotificationTemplateType` / `NotificationTaskType` is wired through
 * BOTH the info-record aggregator path and the handler-factory path.
 *
 * Accepts two required inputs:
 *   - `componentDir`: relative path to the `-firebase` component package.
 *   - `apiDir`: relative path to the API app.
 *
 * Paths escaping the cwd are rejected.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createTwoSideValidateTool } from './validate-tool.js';
import { formatResult, inspectAppNotifications, validateAppNotifications } from './notification-m-validate-app/index.js';

// MARK: Tool definition
const DBX_NOTIFICATION_M_VALIDATE_APP_TOOL: Tool = {
  name: 'dbx_notification_m_validate_app',
  description: [
    'Validate that every notification template + notification task declared in a `-firebase` component package is wired through the two registration paths in the API app: the info-record aggregator (`<APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD` → `appNotificationTemplateTypeInfoRecordService(...)`) AND the handler factory (`<app>NotificationTemplateServiceConfigsArrayFactory` for templates, `notificationTaskService({ handlers })` for tasks).',
    '',
    'Cross-file tracing follows direct calls and spread (`...fooNotifications(context)` / `...ALL_X_NOTIFICATION_TEMPLATE_TYPE_INFOS`) through every `.ts` file under `src/lib/model/notification/` on the component side and `src/app/common/model/notification/` on the API side.',
    '',
    'External identifiers imported from `@dereekb/*` are trusted — spreads and handler `type:` references that resolve into upstream packages do not produce orphan/unresolved errors.',
    '',
    'Provide both:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: {
        type: 'string',
        description: 'Relative path to the `-firebase` component package (e.g. `components/demo-firebase`).'
      },
      apiDir: {
        type: 'string',
        description: 'Relative path to the API app (e.g. `apps/demo-api`).'
      }
    },
    required: ['componentDir', 'apiDir']
  }
};

export const notificationMValidateAppTool: DbxTool = createTwoSideValidateTool({
  definition: DBX_NOTIFICATION_M_VALIDATE_APP_TOOL,
  inspectAndValidate: async ({ componentAbs, componentRel, apiAbs, apiRel }) => {
    const inspection = await inspectAppNotifications(componentAbs, apiAbs);
    return validateAppNotifications(inspection, { componentDir: componentRel, apiDir: apiRel });
  },
  format: formatResult
});
