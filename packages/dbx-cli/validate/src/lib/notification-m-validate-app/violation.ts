/**
 * Shared violation builder and message fragments for the `dbx_notification_m_validate_app` rule files (`rules.ts`,
 * `rules.taskbot.ts`, `rules.upstream.ts`).
 */

import { attachRemediation } from '../_core/rule-catalog/index.js';
import type { ExtractedTaskServiceCall, Violation, ViolationSeverity } from './types.js';

/**
 * The API folders the notification scan reads, for "not found" messages.
 */
export const SCANNED_API_FOLDERS = '`src/app/common/model/notification/`, `src/app/common/firebase/` and `src/app/function/notification/`';

/**
 * Appends a violation to the buffer, defaulting its severity to `error` and attaching the rule catalog's remediation
 * hint for its code.
 *
 * @param buffer - The mutable violation buffer.
 * @param violation - The violation, without its remediation (and optionally without its severity).
 */
export function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity' | 'remediation'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    side: violation.side,
    file: violation.file,
    remediation: attachRemediation(violation.code)
  };
  buffer.push(filled);
}

/**
 * Names a task service's `validate` in a message: `` `validate` ``. When `validate` names one of the app's component
 * aggregates directly, the aggregate and its location follow:
 * `` `validate` (`ALL_NOTIFICATION_TASK_TYPES`, src/lib/model/notification/notification.task.ts:9) ``.
 *
 * @param call - The task service call.
 * @returns The code-formatted text.
 */
export function taskServiceValidateText(call: ExtractedTaskServiceCall): string {
  const aggregate = call.validateAggregate;
  return aggregate ? `\`validate\` (\`${aggregate.symbolName}\`, ${aggregate.sourceFile}:${aggregate.line})` : '`validate`';
}

/**
 * The fix for an upstream aggregate a task service's `validate` doesn't list: `` Add it (from `@dereekb/firebase`) ``. When
 * `validate` names a component aggregate directly, it also says where: in that aggregate, or next to it in a `validate`
 * literal.
 *
 * @param call - The task service call.
 * @param aggregate - The missing upstream aggregate, e.g. `ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`.
 * @returns The fix, without its closing "so …" clause.
 */
export function addToValidateFixText(call: ExtractedTaskServiceCall, aggregate: string): string {
  const named = call.validateAggregate?.symbolName;
  return named ? `Add it (from \`@dereekb/firebase\`) to \`${named}\`, or write \`validate: [...${named}, ...${aggregate}]\`` : 'Add it (from `@dereekb/firebase`)';
}
