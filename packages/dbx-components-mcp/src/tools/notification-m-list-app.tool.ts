/**
 * `dbx_notification_m_list_app` tool.
 *
 * Emits a human-readable report of every notification template + task
 * configured in a downstream `-firebase` component + API app pair.
 * Each entry reports its type code, metadata, and both registration
 * flags (`inInfoRecord` for templates, `inAllArray`/`inValidateList`/
 * `hasHandler` for tasks) so reviewers can see at a glance what's
 * configured and whether it's fully wired. Apps that use NotificationTaskBots
 * also get a NotificationTaskBot section (`taskBot` in JSON): the script
 * registry and its wiring, the NTBR handler's processors / `validate` /
 * reachability, the repair sweep, and one entry per script type, with
 * scripts that set no `dataType` marked ℹ️.
 *
 * Reuses the cross-file extractor from
 * `dbx_notification_m_validate_app` — no duplicate AST walk.
 *
 * Accepts the same `componentDir` + `apiDir` as the validator, plus an
 * optional `format: 'markdown' | 'json'` (default markdown).
 */
import type { Tool } from '@modelcontextprotocol/server';
import { type DbxTool } from './types.js';
import { createListAppTool } from './validate-tool.js';
import { notificationValidateApp, notificationListApp } from '@dereekb/dbx-cli/validate';
const { inspectAppNotifications } = notificationValidateApp;
const { formatReportAsJson, formatReportAsMarkdown, listAppNotifications } = notificationListApp;

// MARK: Tool definition
const DBX_NOTIFICATION_M_LIST_APP_TOOL: Tool = {
  name: 'dbx_notification_m_list_app',
  description: [
    'List every notification template + notification task configured in a downstream `-firebase` component + API app pair. Each entry reports its type code, metadata (human name, description, notification/target model identity), and registration flags — `inInfoRecord` + `hasFactory` for templates, `inAllArray` + `inValidateList` + `hasHandler` for tasks. Templates also report `userConfigurableDeliveryMethods` (with a `default` / `declared` / `unresolved` source), `forcedDeliveryMethods` (always-on methods, with the same kind of source) and `factoryContentDeliveryMethods`, the channels their factory builds content for.',
    '',
    'For apps that use NotificationTaskBots the report has a NotificationTaskBot section (`taskBot` in JSON): `inUse`; the script registries and whether an `appNotificationTaskBotScriptConfigService(...)` call passes them (`wired`), plus every such call with its kind; each NTBR handler with whether `notificationTaskService({ handlers })` reaches it (`reachable`), its processors and its `validate`; whether the task service `validate` lists the NotificationTaskBot task types (`taskTypesInTaskServiceValidate`); the `repairAllNotificationTaskBots()` calls (`repairCalls`); and one entry per script type with its config (`humanName`, `groupKey`, `allowOwnerOptOut`, `dataTypeSource`), `inRegistry`, `inHandlerValidate` and processors. A script without a `dataType` (`dataTypeSource: none`) is marked ℹ️ (info): `update:entry` refuses data patches for it. `dbx_notification_m_validate_app` reports the wiring problems (`NOTIF_TASK_BOT_*`); the Firestore `ntb` rule / `ntb.nat` index facts appear only as its findings.',
    '',
    'Its JSON is the report part of the `notification.manifest.json` that `dbx-cli-generate-notification-manifest` writes at build time; this tool always scans the current source.',
    '',
    'Cross-file resolution mirrors `dbx_notification_m_validate_app` — spreads and factory composition are traced through every `.ts` file under `src/lib/model/notification/` on the component side and `src/app/common/model/notification/`, `src/app/common/firebase/` and `src/app/function/notification/` on the API side.',
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
