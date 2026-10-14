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
 * Names a task service's `validate` in a message: `` `validate` ``. When `validate` names an aggregate directly, the
 * aggregate follows: a component aggregate with its location,
 * `` `validate` (`ALL_NOTIFICATION_TASK_TYPES`, src/lib/model/notification/notification.task.ts:9) ``, an upstream one by
 * name, `` `validate` (`ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`) ``.
 *
 * @param call - The task service call.
 * @returns The code-formatted text.
 */
export function taskServiceValidateText(call: ExtractedTaskServiceCall): string {
  const { validateAggregate: aggregate, validateUpstreamAggregate: upstream } = call;
  let result = '`validate`';
  if (aggregate) {
    result = `\`validate\` (\`${aggregate.symbolName}\`, ${aggregate.sourceFile}:${aggregate.line})`;
  } else if (upstream) {
    result = `\`validate\` (\`${upstream}\`)`;
  }
  return result;
}

/**
 * The fix for an upstream aggregate a task service's `validate` doesn't list: `` Add it (from `@dereekb/firebase`) ``. When
 * `validate` names an aggregate directly, it also says where. For a component aggregate, that is in that aggregate, or next
 * to it in a `validate` literal. For an upstream aggregate, only the literal. The literal is written the way the task
 * service's file refers to the named aggregate (`ExtractedTaskServiceCall.validateReferenceText`).
 *
 * @param call - The task service call.
 * @param aggregate - The missing upstream aggregate, e.g. `ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`.
 * @returns The fix, without its closing "so …" clause.
 */
export function addToValidateFixText(call: ExtractedTaskServiceCall, aggregate: string): string {
  const { validateAggregate: named, validateReferenceText: written } = call;
  const literal = written === undefined ? undefined : `write \`validate: [...${written}, ...${aggregate}]\``;
  let result = 'Add it (from `@dereekb/firebase`)';
  if (named && literal) {
    result = `${result} to \`${named.symbolName}\`, or ${literal}`;
  } else if (literal) {
    result = `${result}: ${literal}`;
  }
  return result;
}
