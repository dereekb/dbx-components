/**
 * Upstream notification task handlers for `dbx_notification_m_validate_app`.
 *
 * An app lists an upstream `ALL_*_NOTIFICATION_TASK_TYPES` aggregate (`@dereekb/firebase`) in
 * `notificationTaskService({ validate })` and registers the handler an upstream factory (`@dereekb/firebase-server/model`)
 * builds. Both names cross into `@dereekb/*`, so the trust list used to skip both sides, and a missing handler only showed
 * up as `notificationTaskService()`'s startup throw. {@link UPSTREAM_NOTIFICATION_TASK_HANDLERS} pairs each aggregate with
 * its handler factory, the handlers trace in `extract.ts` records every reached factory call, and `rules.upstream.ts`
 * (plus `rules.taskbot.ts` for the NotificationTaskBot row) reports a listed aggregate whose handler is not reachable.
 *
 * Names are mirrored as strings, not imported; `handlers.upstream.spec.ts` guards them against the upstream sources.
 */

import { Node, SyntaxKind, type SourceFile } from 'ts-morph';
import { apiRelPath } from '../_core/_validate/ast.js';
import { ALL_NOTIFICATION_TASK_BOT_TASK_TYPES, NOTIFICATION_TASK_BOT_RUN_HANDLER_FACTORY, NOTIFICATION_TASK_BOT_RUN_TASK_TYPE } from './extract.taskbot.js';
import type { ExtractedTaskServiceCall, ExtractedUpstreamHandlerCall, ExtractedUpstreamHandlerFactoryCall, ViolationCode } from './types.js';

/**
 * An upstream task type: its constant and its runtime code.
 */
export interface UpstreamNotificationTaskType {
  readonly constant: string;
  readonly code: string;
}

/**
 * An upstream `validate` aggregate and the upstream handler factory that must handle its task types.
 */
export interface UpstreamNotificationTaskHandlerContract {
  /**
   * Feature label used in messages, e.g. `StorageFile processing`.
   */
  readonly label: string;
  /**
   * The upstream `ALL_*_NOTIFICATION_TASK_TYPES` aggregate (`@dereekb/firebase`).
   */
  readonly aggregate: string;
  /**
   * The task types the aggregate holds, in order. The drift spec pins them.
   */
  readonly taskTypes: readonly UpstreamNotificationTaskType[];
  /**
   * The upstream factory (`@dereekb/firebase-server/model`) that builds the handler for those task types.
   */
  readonly handlerFactory: string;
  /**
   * The factory's config, shown in the fix text.
   */
  readonly handlerFactoryConfigHint: string;
  /**
   * The app-side wrapper shown in the fix text (`<app>` is the app prefix).
   */
  readonly exampleWrapper: string;
  /**
   * When set, this rule reports the pair instead of `NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED`.
   */
  readonly dedicatedCode?: ViolationCode;
}

/**
 * Every upstream task-type aggregate whose handler comes from an upstream factory.
 */
export const UPSTREAM_NOTIFICATION_TASK_HANDLERS: readonly UpstreamNotificationTaskHandlerContract[] = [
  {
    label: 'StorageFile processing',
    aggregate: 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES',
    taskTypes: [{ constant: 'STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE', code: 'SFP' }],
    handlerFactory: 'storageFileProcessingNotificationTaskHandler',
    handlerFactoryConfigHint: '{ processors, storageFileFirestoreCollections, storageAccessor }',
    exampleWrapper: '<app>StorageFileProcessingNotificationTaskHandler(context)'
  },
  {
    label: 'FormSpace submission',
    aggregate: 'ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES',
    taskTypes: [{ constant: 'FORM_SPACE_SUBMISSION_NOTIFICATION_TASK_TYPE', code: 'FSPS' }],
    handlerFactory: 'formSpaceSubmissionNotificationTaskHandler',
    handlerFactoryConfigHint: '{ processors, validate, formSpaceFirestoreCollections }',
    exampleWrapper: '<app>FormSpaceSubmissionNotificationTaskHandler(context)'
  },
  {
    label: 'NotificationTaskBot run',
    aggregate: ALL_NOTIFICATION_TASK_BOT_TASK_TYPES,
    taskTypes: [{ constant: NOTIFICATION_TASK_BOT_RUN_TASK_TYPE, code: 'NTBR' }],
    handlerFactory: NOTIFICATION_TASK_BOT_RUN_HANDLER_FACTORY,
    handlerFactoryConfigHint: '{ processors, validate, notificationTaskBotContext }',
    exampleWrapper: '<app>NotificationTaskBotRunNotificationTaskHandler(context)',
    dedicatedCode: 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED'
  }
];

/**
 * The handler factory names from {@link UPSTREAM_NOTIFICATION_TASK_HANDLERS}.
 */
export const UPSTREAM_NOTIFICATION_TASK_HANDLER_FACTORIES: ReadonlySet<string> = new Set(UPSTREAM_NOTIFICATION_TASK_HANDLERS.map((x) => x.handlerFactory));

/**
 * Returns the upstream handler factory {@link node} calls. The callee must be an identifier with the factory's exact name;
 * import aliases are not resolved.
 *
 * @param node - Any node.
 * @returns The factory name, or `undefined` when {@link node} is not an upstream handler factory call.
 */
export function upstreamHandlerFactoryOf(node: Node): string | undefined {
  let result: string | undefined;
  if (Node.isCallExpression(node)) {
    const callee = node.getExpression();
    if (Node.isIdentifier(callee) && UPSTREAM_NOTIFICATION_TASK_HANDLER_FACTORIES.has(callee.getText())) {
      result = callee.getText();
    }
  }
  return result;
}

/**
 * Returns how a `notificationTaskService(...)` call's `validate` lists {@link contract}'s task types: the aggregate spread
 * (`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`) or the first member constant written directly.
 *
 * @param call - The task service call.
 * @param contract - The upstream pair.
 * @returns The listing as written in `validate`, or `undefined` when the call does not list the task types.
 */
export function upstreamTaskTypesListing(call: ExtractedTaskServiceCall, contract: UpstreamNotificationTaskHandlerContract): string | undefined {
  let result: string | undefined;
  if (call.spreadValidateIdentifiers.includes(contract.aggregate)) {
    result = `...${contract.aggregate}`;
  } else {
    result = contract.taskTypes.find((x) => call.validateIdentifiers.includes(x.constant))?.constant;
  }
  return result;
}

/**
 * Returns the calls of {@link factory} the call's `handlers` trace reached.
 *
 * @param call - The task service call.
 * @param factory - An upstream handler factory name.
 * @returns The reached calls of that factory.
 */
export function reachedUpstreamHandlerCallsOf(call: ExtractedTaskServiceCall, factory: string): readonly ExtractedUpstreamHandlerCall[] {
  return call.reachedUpstreamHandlerCalls.filter((x) => x.factory === factory);
}

/**
 * Whether the scanner followed every value of the call's `handlers`: the property resolved to an array literal, every
 * unresolved identifier is a revisit of an already-resolved one, and no value was opaque. Only then can a missing
 * upstream handler be reported without risking a false error.
 *
 * `unresolvedHandlerSpreadIdentifiers` is not checked: it lists every spread name by design.
 *
 * @param call - The task service call.
 * @returns `true` when the trace is complete.
 */
export function isHandlersTraceComplete(call: ExtractedTaskServiceCall): boolean {
  const resolved = new Set(call.resolvedHandlerBindings);
  return call.handlersStatus === 'resolved' && call.opaqueHandlerValues.length === 0 && call.unresolvedHandlerBindings.every((name) => resolved.has(name));
}

/**
 * Records every upstream handler factory call in the API sources, reachable or not, with the named function that builds it.
 *
 * @param apiSources - The API source files.
 * @returns One entry per call, in source order.
 */
export function extractUpstreamHandlerCalls(apiSources: readonly SourceFile[]): readonly ExtractedUpstreamHandlerFactoryCall[] {
  const out: ExtractedUpstreamHandlerFactoryCall[] = [];
  for (const sf of apiSources) {
    const sourceFile = apiRelPath(sf);
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const factory = upstreamHandlerFactoryOf(call);
      if (factory !== undefined) {
        out.push({ factory, sourceFile, line: call.getStartLineNumber(), enclosingFunction: enclosingFunctionName(call) });
      }
    }
  }
  return out;
}

/**
 * Returns the nearest named function around {@link node}: a function declaration, a method, or an arrow function /
 * function expression assigned to a variable.
 *
 * @param node - The node.
 * @returns The function name, or `undefined` at module scope.
 */
function enclosingFunctionName(node: Node): string | undefined {
  let result: string | undefined;
  let current = node.getParent();
  while (current !== undefined && result === undefined) {
    if (Node.isFunctionDeclaration(current) || Node.isMethodDeclaration(current)) {
      result = current.getName();
    } else if ((Node.isArrowFunction(current) || Node.isFunctionExpression(current)) && Node.isVariableDeclaration(current.getParent())) {
      result = current.getParentOrThrow().asKindOrThrow(SyntaxKind.VariableDeclaration).getName();
    }
    current = current.getParent();
  }
  return result;
}
