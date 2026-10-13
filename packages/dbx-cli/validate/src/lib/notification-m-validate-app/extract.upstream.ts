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
 * `rules.upstream.ts` also reports the reverse case: a reachable handler whose aggregate `validate` doesn't list
 * (`NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE`, through {@link selectUpstreamTaskTypesNotInValidate} and guarded by
 * {@link isValidateListingConclusive}). `rules.taskbot.ts` reports the NotificationTaskBot row of both directions.
 *
 * The factory match resolves `@dereekb/*` import aliases, namespace imports and local `const` references per file
 * (`readCalleeName`), so `sfHandler(...)`, `serverModel.storageFileProcessingNotificationTaskHandler(...)` and
 * `create(...)` after `const create = storageFileProcessingNotificationTaskHandler` count as factory calls.
 *
 * The `validate` expansion in `extract.ts` also records the upstream names an app nests in its own component
 * `ALL_*_NOTIFICATION_TASK_TYPES` aggregates (`ExtractedTaskServiceCall.nestedUpstreamValidateListings`), so
 * {@link upstreamTaskTypesListings} sees `validate: [...ALL_NOTIFICATION_TASK_TYPES]` whose component aggregate spreads
 * `...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`.
 *
 * Names are mirrored as strings, not imported; `handlers.upstream.spec.ts` guards them against the upstream sources.
 */

import { Node, SyntaxKind, type SourceFile } from 'ts-morph';
import { apiRelPath, readCalleeName, type DereekbImportIndex } from '../_core/_validate/ast.js';
import { ALL_NOTIFICATION_TASK_BOT_TASK_TYPES, NOTIFICATION_TASK_BOT_RUN_HANDLER_FACTORY, NOTIFICATION_TASK_BOT_RUN_TASK_TYPE } from './extract.taskbot.js';
import type { ExtractedAppNotifications, ExtractedNestedUpstreamValidateListing, ExtractedTaskServiceCall, ExtractedTaskTypeAggregateArray, ExtractedUpstreamHandlerCall, ExtractedUpstreamHandlerFactoryCall, ViolationCode } from './types.js';

/**
 * An upstream task type: its constant and its runtime code.
 */
export interface UpstreamNotificationTaskType {
  readonly constant: string;
  readonly code: string;
}

/**
 * The codes a table row reports under when its feature has rules of its own (`rules.taskbot.ts` for the NotificationTaskBot
 * row). The generic `NOTIF_TASK_UPSTREAM_*` rules skip such a row.
 */
export interface UpstreamNotificationTaskHandlerDedicatedCodes {
  /**
   * Reported instead of `NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED`.
   */
  readonly handlerNotRegistered: ViolationCode;
  /**
   * Reported instead of `NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE`.
   */
  readonly taskTypesNotInValidate: ViolationCode;
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
   * When set, the feature's own rules report this row under these codes, and the generic `NOTIF_TASK_UPSTREAM_*` rules skip it.
   */
  readonly dedicatedCodes?: UpstreamNotificationTaskHandlerDedicatedCodes;
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
    dedicatedCodes: { handlerNotRegistered: 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED', taskTypesNotInValidate: 'NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE' }
  }
];

/**
 * The handler factory names from {@link UPSTREAM_NOTIFICATION_TASK_HANDLERS}.
 */
export const UPSTREAM_NOTIFICATION_TASK_HANDLER_FACTORIES: ReadonlySet<string> = new Set(UPSTREAM_NOTIFICATION_TASK_HANDLERS.map((x) => x.handlerFactory));

/**
 * The aggregates from {@link UPSTREAM_NOTIFICATION_TASK_HANDLERS}.
 */
export const UPSTREAM_NOTIFICATION_TASK_AGGREGATES: ReadonlySet<string> = new Set(UPSTREAM_NOTIFICATION_TASK_HANDLERS.map((x) => x.aggregate));

/**
 * Every task-type constant from {@link UPSTREAM_NOTIFICATION_TASK_HANDLERS}.
 */
export const UPSTREAM_NOTIFICATION_TASK_TYPE_CONSTANTS: ReadonlySet<string> = new Set(UPSTREAM_NOTIFICATION_TASK_HANDLERS.flatMap((x) => x.taskTypes.map((y) => y.constant)));

/**
 * Returns the upstream handler factory {@link node} calls: called directly, through an `@dereekb/*` import alias, as a
 * member of an `@dereekb/*` namespace import, or through a local `const` holding one of those.
 *
 * @param node - Any node.
 * @param imports - The per-file `@dereekb/*` import bindings.
 * @returns The factory's exported name, or `undefined` when {@link node} is not an upstream handler factory call.
 */
export function upstreamHandlerFactoryOf(node: Node, imports: DereekbImportIndex): string | undefined {
  let result: string | undefined;
  if (Node.isCallExpression(node)) {
    const name = readCalleeName(node, imports);
    if (name !== undefined && UPSTREAM_NOTIFICATION_TASK_HANDLER_FACTORIES.has(name)) {
      result = name;
    }
  }
  return result;
}

/**
 * One way a `notificationTaskService(...)` call's `validate` lists an upstream pair's task types.
 */
export interface UpstreamTaskTypesListing {
  /**
   * The listing as written: `...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`, or a member constant.
   */
  readonly text: string;
  /**
   * Set when `validate` reaches it through the app's own component aggregates.
   */
  readonly nested?: ExtractedNestedUpstreamValidateListing;
}

/**
 * Returns every way a `notificationTaskService(...)` call's `validate` lists {@link contract}'s task types. The direct
 * listing comes first: the aggregate spread (`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`), or else the first member
 * constant written in the literal. Then come the listings it reaches through the app's own component aggregates
 * (`ExtractedTaskServiceCall.nestedUpstreamValidateListings`). An empty result means the call does not list them.
 *
 * @param call - The task service call.
 * @param contract - The upstream pair.
 * @returns The listings, direct first.
 */
export function upstreamTaskTypesListings(call: ExtractedTaskServiceCall, contract: UpstreamNotificationTaskHandlerContract): readonly UpstreamTaskTypesListing[] {
  const result: UpstreamTaskTypesListing[] = [];
  const constants = new Set(contract.taskTypes.map((x) => x.constant));
  if (call.spreadValidateIdentifiers.includes(contract.aggregate)) {
    result.push({ text: `...${contract.aggregate}` });
  } else {
    const constant = contract.taskTypes.find((x) => call.validateIdentifiers.includes(x.constant))?.constant;
    if (constant !== undefined) {
      result.push({ text: constant });
    }
  }
  for (const nested of call.nestedUpstreamValidateListings) {
    const matches = nested.spread ? nested.identifier === contract.aggregate : constants.has(nested.identifier);
    if (matches) {
      result.push({ text: nested.spread ? `...${nested.identifier}` : nested.identifier, nested });
    }
  }
  return result;
}

/**
 * Whether {@link upstreamTaskTypesListings} can be trusted when it finds nothing. That holds when all of these are true:
 * - the call's `validate` resolved to an array literal;
 * - every element is an identifier or a spread of one;
 * - every spread names an upstream aggregate from {@link UPSTREAM_NOTIFICATION_TASK_HANDLERS}, or one of the app's own
 *   `ALL_*_NOTIFICATION_TASK_TYPES`;
 * - the expansion of the app's aggregates placed every value it found (`ExtractedTaskServiceCall.opaqueNestedValidateValues`
 *   is empty): no unreadable value, no spread it doesn't know, no upstream task-type constant or aggregate that isn't
 *   imported from `@dereekb/*`.
 *
 * An upstream task type held in a spread the scanner doesn't know (an aggregate from another library, an aliased import)
 * would read as missing; those cases are inconclusive.
 *
 * @param call - The task service call.
 * @param appAggregates - The app's own task-type aggregates (`ExtractedAppNotifications.taskAllTypesAggregates`).
 * @returns `true` when a missing listing is real.
 */
export function isValidateListingConclusive(call: ExtractedTaskServiceCall, appAggregates: readonly ExtractedTaskTypeAggregateArray[]): boolean {
  const appAggregateNames = new Set(appAggregates.map((x) => x.symbolName));
  return call.validateStatus === 'resolved' && call.opaqueValidateValues.length === 0 && call.opaqueNestedValidateValues.length === 0 && call.spreadValidateIdentifiers.every((name) => UPSTREAM_NOTIFICATION_TASK_AGGREGATES.has(name) || appAggregateNames.has(name));
}

/**
 * A task service whose `handlers` reach a table row's handler while its `validate` doesn't list the row's task types.
 */
export interface UpstreamTaskTypesNotInValidate {
  readonly call: ExtractedTaskServiceCall;
  readonly contract: UpstreamNotificationTaskHandlerContract;
  /**
   * The first reached call of the row's handler factory.
   */
  readonly handlerCall: ExtractedUpstreamHandlerCall;
}

/**
 * Selects every task service and table row where an upstream handler is reachable but `validate` lists neither the row's
 * aggregate nor one of its task-type constants, directly or through the app's own aggregates
 * ({@link upstreamTaskTypesListings}), which is the reverse of
 * `NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED`. Only services whose listing is conclusive count
 * ({@link isValidateListingConclusive}). Rows with `dedicatedCodes` are included; each rule keeps its own rows.
 *
 * A reached call is strong evidence that the handler is registered, so the `handlers` trace doesn't need to be complete:
 * an incomplete trace only hides handlers, which means fewer findings, never false ones.
 *
 * @param extracted - The extraction; only its `taskServiceCalls` and `taskAllTypesAggregates` are read.
 * @returns One entry per service and row, in source and table order.
 */
export function selectUpstreamTaskTypesNotInValidate(extracted: Pick<ExtractedAppNotifications, 'taskServiceCalls' | 'taskAllTypesAggregates'>): readonly UpstreamTaskTypesNotInValidate[] {
  const out: UpstreamTaskTypesNotInValidate[] = [];
  for (const call of extracted.taskServiceCalls) {
    if (isValidateListingConclusive(call, extracted.taskAllTypesAggregates)) {
      for (const contract of UPSTREAM_NOTIFICATION_TASK_HANDLERS) {
        const handlerCall = call.reachedUpstreamHandlerCalls.find((x) => x.factory === contract.handlerFactory);
        if (handlerCall !== undefined && upstreamTaskTypesListings(call, contract).length === 0) {
          out.push({ call, contract, handlerCall });
        }
      }
    }
  }
  return out;
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
 * @param imports - The per-file `@dereekb/*` import bindings.
 * @returns One entry per call, in source order.
 */
export function extractUpstreamHandlerCalls(apiSources: readonly SourceFile[], imports: DereekbImportIndex): readonly ExtractedUpstreamHandlerFactoryCall[] {
  const out: ExtractedUpstreamHandlerFactoryCall[] = [];
  for (const sf of apiSources) {
    const sourceFile = apiRelPath(sf);
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const factory = upstreamHandlerFactoryOf(call, imports);
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
