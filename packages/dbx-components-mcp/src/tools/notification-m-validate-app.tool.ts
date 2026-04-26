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

import { resolve, sep } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
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

// MARK: Input validation
const ValidateArgsType = type({
  componentDir: 'string',
  apiDir: 'string'
});

interface ParsedArgs {
  readonly componentDir: string;
  readonly apiDir: string;
}

function parseArgs(raw: unknown): ParsedArgs {
  const parsed = ValidateArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedArgs = {
    componentDir: parsed.componentDir,
    apiDir: parsed.apiDir
  };
  return result;
}

// MARK: Path guard
function ensureInsideCwd(relativePath: string, cwd: string): string {
  const absolute = resolve(cwd, relativePath);
  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!absolute.startsWith(cwdPrefix) && absolute !== cwd) {
    throw new Error(`Path \`${relativePath}\` resolves outside the server cwd and is not allowed.`);
  }
  return absolute;
}

// MARK: Handler
/**
 * Tool handler for `dbx_validate_app_notification_m`. Walks the resolved app
 * tree, runs the cross-file notification rules, and returns the aggregated
 * report — the strictest of the notification validators.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted validation report, or an error result when args fail validation
 */
export async function runNotificationMValidateApp(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const cwd = process.cwd();
  let componentAbs: string;
  let apiAbs: string;
  try {
    componentAbs = ensureInsideCwd(args.componentDir, cwd);
    apiAbs = ensureInsideCwd(args.apiDir, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const inspection = await inspectAppNotifications(componentAbs, apiAbs);
  const validation = validateAppNotifications(inspection, { componentDir: args.componentDir, apiDir: args.apiDir });
  const text = formatResult(validation);
  const result: ToolResult = {
    content: [{ type: 'text', text }],
    isError: validation.errorCount > 0
  };
  return result;
}

export const notificationMValidateAppTool: DbxTool = {
  definition: DBX_NOTIFICATION_M_VALIDATE_APP_TOOL,
  run: runNotificationMValidateApp
};
