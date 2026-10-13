/**
 * Shared violation builder and message fragments for the `dbx_notification_m_validate_app` rule files (`rules.ts`,
 * `rules.taskbot.ts`, `rules.upstream.ts`).
 */

import { attachRemediation } from '../_core/rule-catalog/index.js';
import type { Violation, ViolationSeverity } from './types.js';

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
