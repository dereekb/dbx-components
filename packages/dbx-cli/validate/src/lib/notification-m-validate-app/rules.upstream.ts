/**
 * Upstream task handler rule (`NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED`) for `dbx_notification_m_validate_app`.
 *
 * Checks every `notificationTaskService(...)` call against `UPSTREAM_NOTIFICATION_TASK_HANDLERS`: when `validate` lists an
 * upstream aggregate, its upstream handler factory must be reachable from that call's `handlers`. Only fires when the
 * call's `handlers` trace is complete, so it never raises a false error; the runtime startup check stays the backstop.
 */

import { isHandlersTraceComplete, reachedUpstreamHandlerCallsOf, UPSTREAM_NOTIFICATION_TASK_HANDLERS, upstreamTaskTypesListing, type UpstreamNotificationTaskHandlerContract } from './extract.upstream.js';
import type { ExtractedAppNotifications, ExtractedTaskServiceCall, ExtractedUpstreamHandlerFactoryCall, Violation } from './types.js';
import { pushViolation, SCANNED_API_FOLDERS } from './violation.js';

/**
 * Runs `NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED` over every task service call. Table rows with a `dedicatedCode` are
 * reported by their own rule.
 *
 * @param extracted - The full extraction; only its `taskServiceCalls` and `upstreamHandlerCalls` are read.
 * @param violations - The mutable violation buffer.
 */
export function checkUpstreamTaskHandlers(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  for (const call of extracted.taskServiceCalls) {
    for (const contract of UPSTREAM_NOTIFICATION_TASK_HANDLERS) {
      const listing = contract.dedicatedCode === undefined ? upstreamTaskTypesListing(call, contract) : undefined;
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
  const codes = contract.taskTypes.map((x) => `\`${x.code}\``).join(', ');
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
