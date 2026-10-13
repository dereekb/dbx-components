/**
 * Upstream task handler rules (`NOTIF_TASK_UPSTREAM_*`) for `dbx_notification_m_validate_app`.
 *
 * Checks every `notificationTaskService(...)` call against `UPSTREAM_NOTIFICATION_TASK_HANDLERS`, in both directions:
 * - `NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED` (error): when `validate` lists an upstream aggregate, its upstream handler
 *   factory must be reachable from that call's `handlers`. Only fires when the call's `handlers` trace is complete, so it
 *   never raises a false error; the runtime startup check stays the backstop.
 * - `NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE` (warning): when an upstream handler is reachable, `validate` should list
 *   its aggregate, so startup fails if the handler is ever removed. Only fires when the scanner read every value of
 *   `validate` (`isValidateListingConclusive`), so the task types can't be hidden somewhere it didn't look.
 *
 * Table rows with `dedicatedCodes` (the NotificationTaskBot row) are reported by their own rules in `rules.taskbot.ts`.
 */

import { isHandlersTraceComplete, reachedUpstreamHandlerCallsOf, selectUpstreamTaskTypesNotInValidate, UPSTREAM_NOTIFICATION_TASK_HANDLERS, upstreamTaskTypesListing, type UpstreamNotificationTaskHandlerContract, type UpstreamTaskTypesNotInValidate } from './extract.upstream.js';
import type { ExtractedAppNotifications, ExtractedTaskServiceCall, ExtractedUpstreamHandlerFactoryCall, Violation } from './types.js';
import { pushViolation, SCANNED_API_FOLDERS } from './violation.js';

/**
 * Runs both upstream task handler rules over every task service call. Table rows with `dedicatedCodes` are reported by their
 * own rules.
 *
 * @param extracted - The full extraction; only its `taskServiceCalls`, `taskAllTypesAggregates` and `upstreamHandlerCalls` are read.
 * @param violations - The mutable violation buffer.
 */
export function checkUpstreamTaskHandlers(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  checkHandlersRegistered(extracted, violations);
  checkTaskTypesInValidate(extracted, violations);
}

/**
 * Formats a table row's task-type codes for messages (`` `SFP` ``).
 *
 * @param contract - The upstream pair.
 * @returns The codes, comma-separated and code-formatted.
 */
function taskTypeCodesText(contract: UpstreamNotificationTaskHandlerContract): string {
  return contract.taskTypes.map((x) => `\`${x.code}\``).join(', ');
}

// MARK: NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED
function checkHandlersRegistered(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  for (const call of extracted.taskServiceCalls) {
    for (const contract of UPSTREAM_NOTIFICATION_TASK_HANDLERS) {
      const listing = contract.dedicatedCodes === undefined ? upstreamTaskTypesListing(call, contract) : undefined;
      if (listing !== undefined && reachedUpstreamHandlerCallsOf(call, contract.handlerFactory).length === 0 && isHandlersTraceComplete(call)) {
        pushUpstreamHandlerNotRegistered({ call, contract, listing, built: extracted.upstreamHandlerCalls.find((x) => x.factory === contract.handlerFactory), violations });
      }
    }
  }
}

interface PushUpstreamHandlerNotRegisteredInput {
  readonly call: ExtractedTaskServiceCall;
  readonly contract: UpstreamNotificationTaskHandlerContract;
  /**
   * How `validate` lists the task types, from `upstreamTaskTypesListing`.
   */
  readonly listing: string;
  /**
   * The first call of the handler factory anywhere in the scanned API files, if any.
   */
  readonly built: ExtractedUpstreamHandlerFactoryCall | undefined;
  readonly violations: Violation[];
}

function pushUpstreamHandlerNotRegistered(input: PushUpstreamHandlerNotRegisteredInput): void {
  const { call, contract, listing, built, violations } = input;
  const codes = taskTypeCodesText(contract);
  const genericFix = `Add the ${contract.label} handler (e.g. \`${contract.exampleWrapper}\`, built with \`${contract.handlerFactory}(${contract.handlerFactoryConfigHint})\` from \`@dereekb/firebase-server/model\`) to \`handlers\`, or remove \`${listing}\` from \`validate\`.`;
  let problem: string;
  let fix: string;
  if (built?.enclosingFunction !== undefined) {
    problem = `the handler \`${built.enclosingFunction}\` builds (${built.sourceFile}:${built.line}) is not reachable from its \`handlers\``;
    fix = `Add \`${built.enclosingFunction}(...)\` to \`handlers\`, or remove \`${listing}\` from \`validate\`.`;
  } else if (built === undefined) {
    problem = `no \`${contract.handlerFactory}(...)\` call was found in ${SCANNED_API_FOLDERS}`;
    fix = genericFix;
  } else {
    problem = `the handler built at ${built.sourceFile}:${built.line} is not reachable from its \`handlers\``;
    fix = genericFix;
  }
  pushViolation(violations, {
    code: 'NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED',
    message: `\`notificationTaskService(...)\` in ${call.sourceFile} lists \`${listing}\` (${contract.label}: ${codes}) in \`validate\`, but ${problem}. \`notificationTaskService()\` throws at startup for this. ${fix}`,
    side: 'api',
    file: call.sourceFile
  });
}

// MARK: NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE
function checkTaskTypesInValidate(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  for (const finding of selectUpstreamTaskTypesNotInValidate(extracted)) {
    if (finding.contract.dedicatedCodes === undefined) {
      pushUpstreamTaskTypesNotInValidate(finding, violations);
    }
  }
}

function pushUpstreamTaskTypesNotInValidate(finding: UpstreamTaskTypesNotInValidate, violations: Violation[]): void {
  const { call, contract, handlerCall } = finding;
  pushViolation(violations, {
    code: 'NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE',
    severity: 'warning',
    message: `\`notificationTaskService(...)\` in ${call.sourceFile} registers the ${contract.label} handler (\`${contract.handlerFactory}(...)\` at ${handlerCall.sourceFile}:${handlerCall.line}), but its \`validate\` does not list \`...${contract.aggregate}\` (${taskTypeCodesText(contract)}). Add it (from \`@dereekb/firebase\`), so \`notificationTaskService()\` fails at startup if the handler is ever removed.`,
    side: 'api',
    file: call.sourceFile
  });
}
