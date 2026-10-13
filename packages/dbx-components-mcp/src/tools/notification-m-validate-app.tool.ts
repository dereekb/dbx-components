/**
 * `dbx_notification_m_validate_app` tool.
 *
 * Cross-file verifier for downstream app notifications. Reads the
 * component package's `src/lib/model/notification/` and the API app's
 * `src/app/common/model/notification/`, `src/app/common/firebase/` and
 * `src/app/function/notification/`, then asserts every declared
 * `NotificationTemplateType` / `NotificationTaskType` is wired through
 * BOTH the info-record aggregator path and the handler-factory path, and
 * (for apps that use bots) that the NotificationTaskBot wiring is complete.
 *
 * Accepts two required inputs:
 *   - `componentDir`: relative path to the `-firebase` component package.
 *   - `apiDir`: relative path to the API app.
 *
 * And two optional workspace files (defaulting to the workspace root's):
 *   - `rulesFile`: `firestore.rules`.
 *   - `indexesFile`: `firestore.indexes.json`.
 *
 * Paths escaping the cwd are rejected.
 */
import type { Tool } from '@modelcontextprotocol/server';
import { type DbxTool } from './types.js';
import { createTwoSideValidateTool } from './validate-tool.js';
import { notificationValidateApp } from '@dereekb/dbx-cli/validate';
const { formatResult, inspectAppNotifications, validateAppNotifications } = notificationValidateApp;

// MARK: Tool definition
const DBX_NOTIFICATION_M_VALIDATE_APP_TOOL: Tool = {
  name: 'dbx_notification_m_validate_app',
  description: [
    'Validate that every notification template + notification task declared in a `-firebase` component package is wired through the two registration paths in the API app: the info-record aggregator (`<APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD` → `appNotificationTemplateTypeInfoRecordService(...)`) AND the handler factory (`<app>NotificationTemplateServiceConfigsArrayFactory` for templates, `notificationTaskService({ handlers })` for tasks).',
    '',
    'Cross-file tracing follows direct calls and spread (`...fooNotifications(context)` / `...ALL_X_NOTIFICATION_TEMPLATE_TYPE_INFOS`) through every `.ts` file under `src/lib/model/notification/` on the component side and `src/app/common/model/notification/`, `src/app/common/firebase/` and `src/app/function/notification/` on the API side.',
    '',
    'NotificationTaskBot checks (`NOTIF_TASK_BOT_*`, only for apps that use bots): the script registry (`notificationTaskBotScriptConfigRecord`) is declared and passed to `appNotificationTaskBotScriptConfigService(...)`; the NTBR handler (`notificationTaskBotRunNotificationTaskHandler`) is reachable from `notificationTaskService({ handlers })` and `validate` lists `...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES`; every registered or validated script has a processor and every processor target is registered; the notification schedule calls `repairAllNotificationTaskBots()`; `firestore.rules` has a `match /ntb/{...}` block; and `firestore.indexes.json` does not exempt `ntb.nat`. Scaffold a new bot script with `dbx_artifact_scaffold` `notification-task-bot-script`.',
    '',
    "Upstream task types (`NOTIF_TASK_UPSTREAM_*`): when `validate` lists `...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES` or `...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES`, the matching upstream handler (`storageFileProcessingNotificationTaskHandler(...)` / `formSpaceSubmissionNotificationTaskHandler(...)`) must be reachable from that service's `handlers` (`NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED`, skipped when the `handlers` trace can't be followed completely). Aliased `@dereekb/*` imports and namespace calls (`ns.storageFileProcessingNotificationTaskHandler(...)`) are followed. The reverse is a warning: a reachable upstream handler whose aggregate that service's `validate` doesn't list (`NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE`, skipped when the scan can't read every value of `validate`).",
    '',
    'External identifiers imported from `@dereekb/*` are trusted, except the upstream task handlers above — spreads and handler `type:` references that resolve into upstream packages do not produce orphan/unresolved errors.',
    '',
    'The same checks run at build time through `dbx-cli-generate-notification-manifest` (see the `@dereekb/dbx-cli` README); this tool always scans the current source.',
    '',
    'Provide both:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '',
    'Optional:',
    '- `rulesFile`: relative path to the Firestore rules (default `firestore.rules`).',
    '- `indexesFile`: relative path to the Firestore indexes (default `firestore.indexes.json`).',
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
      },
      rulesFile: {
        type: 'string',
        description: 'Relative path to the workspace Firestore rules, read for the NotificationTaskBot `ntb` rule check. Defaults to `firestore.rules`.'
      },
      indexesFile: {
        type: 'string',
        description: 'Relative path to the workspace Firestore indexes, read for the NotificationTaskBot `ntb.nat` index check. Defaults to `firestore.indexes.json`.'
      }
    },
    required: ['componentDir', 'apiDir']
  }
};

export const notificationMValidateAppTool: DbxTool = createTwoSideValidateTool({
  definition: DBX_NOTIFICATION_M_VALIDATE_APP_TOOL,
  workspaceFileArgs: { rulesFile: 'firestore.rules', indexesFile: 'firestore.indexes.json' },
  inspectAndValidate: async ({ componentAbs, componentRel, apiAbs, apiRel, workspaceAbs, workspaceFiles }) => {
    const inspection = await inspectAppNotifications(componentAbs, apiAbs, { firestoreRulesPath: workspaceFiles['rulesFile'], firestoreIndexesPath: workspaceFiles['indexesFile'], workspaceDir: workspaceAbs });
    return validateAppNotifications(inspection, { componentDir: componentRel, apiDir: apiRel });
  },
  format: formatResult
});
