import {
  type DocumentReference,
  type FirebaseAuthOwnershipKey,
  type FirestoreModelKey,
  type Notification,
  type NotificationDocument,
  type NotificationTaskBot,
  type NotificationTaskBotDocument,
  type NotificationTaskBotEmbeddedScriptEntry,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntryId,
  type NotificationTaskBotEntryStatus,
  type NotificationTaskBotFirestoreCollection,
  notificationTaskBotIdForModel,
  type NotificationTaskKey,
  type RepairAllNotificationTaskBotsResult,
  type SendQueuedNotificationsParams,
  type SendQueuedNotificationsResult
} from '@dereekb/firebase';
import {
  type ApplyNotificationTaskBotChangesInput,
  type ApplyNotificationTaskBotChangesInTransactionResult,
  applyNotificationTaskBotChangesFactory,
  type EnsureNotificationTaskBotEntryInput,
  ensureNotificationTaskBotEntryFactory,
  type ScheduleNotificationTaskBotEntryInput,
  scheduleNotificationTaskBotEntryFactory
} from '@dereekb/firebase-server/model';
import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type TestContextFixture } from '@dereekb/util/test';
import { type FirebaseAdminTestContext } from '../../firebase/firebase.admin';
import { type ModelTestContext, ModelTestContextFixture, ModelTestContextInstance, modelTestContextFactory } from '../../firebase/firebase.admin.collection';
import { expectNotificationTaskBotEntryHistory, expectNotificationTaskBotEntryStatus, type NotificationTaskBotEntryHistoryExpectation } from './notification.taskbot.expect';
import {
  assertNotificationTaskBotEntry,
  type ExhaustNotificationTaskBotRunInput,
  type ExhaustNotificationTaskBotRunResult,
  exhaustNotificationTaskBotRun,
  loadNotificationTaskBot,
  loadNotificationTaskBotEntry,
  loadNotificationTaskBotLiveRunTask,
  loadNotificationTaskBotRunTask,
  loadNotificationTaskBotRunTaskDocument,
  type NotificationTaskBotTestServerContext,
  type RepairNotificationTaskBotsAtInput,
  repairNotificationTaskBotsAt,
  type SendNotificationTaskBotRunInput,
  type SendNotificationTaskBotRunResult,
  sendNotificationTaskBotRun,
  type StallNotificationTaskBotRunInput,
  type StallNotificationTaskBotRunResult,
  stallNotificationTaskBotRun
} from './notification.taskbot';

// MARK: Params
/**
 * Any model test context (fixture or instance).
 */
export interface NotificationTaskBotTestContextModel {
  readonly documentKey: FirestoreModelKey;
}

/**
 * An entry the fixture ensures when it creates the bot.
 */
export interface NotificationTaskBotTestContextEntryParams<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> extends Omit<EnsureNotificationTaskBotEntryInput<D>, 'model' | 'owner' | 'now'> {}

/**
 * Params for a NotificationTaskBot test context.
 */
export interface NotificationTaskBotTestContextParams {
  /**
   * The model the bot is attached to. Nest the bot context inside this model's context.
   */
  readonly for: NotificationTaskBotTestContextModel;
  /**
   * Passed on every ensure: a key, or a model test context whose key is used.
   */
  readonly owner?: Maybe<FirebaseAuthOwnershipKey | NotificationTaskBotTestContextModel>;
  /**
   * Ensured in order. With no entries, no bot is created.
   */
  readonly entries?: Maybe<NotificationTaskBotTestContextEntryParams[]>;
  /**
   * The helpers' default entry. Defaults to the first entry's id.
   */
  readonly entryId?: Maybe<NotificationTaskBotEntryId>;
}

/**
 * {@link NotificationTaskBotTestContextParams} plus the parent fixture.
 */
export interface NotificationTaskBotTestContextFactoryParams<PF> extends NotificationTaskBotTestContextParams {
  readonly f: PF;
}

/**
 * The parent test context instance a NotificationTaskBot test context requires.
 */
export interface NotificationTaskBotTestContextParentInstance extends FirebaseAdminTestContext, NotificationTaskBotTestServerContext {}

/**
 * A helper input with the context and model filled in, and the entry defaulted.
 */
export type NotificationTaskBotTestContextEntryInput<T> = Omit<T, 'context' | 'model' | 'entryId'> & { readonly entryId?: Maybe<NotificationTaskBotEntryId> };

/**
 * Config for {@link NotificationTaskBotTestContextInstance}.
 */
export interface NotificationTaskBotTestContextInstanceConfig<PI extends NotificationTaskBotTestContextParentInstance = NotificationTaskBotTestContextParentInstance> {
  readonly collection: NotificationTaskBotFirestoreCollection;
  readonly ref: DocumentReference<NotificationTaskBot>;
  readonly testContext: PI;
  /**
   * Key of the model the bot is attached to.
   */
  readonly modelKey: FirestoreModelKey;
  /**
   * Owner passed on every ensure.
   */
  readonly owner?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * The helpers' default entry.
   */
  readonly defaultEntryId?: Maybe<NotificationTaskBotEntryId>;
}

// MARK: Context
/**
 * The surface of a NotificationTaskBot test context. Every entry-level method defaults to the context's default entry.
 */
export interface NotificationTaskBotTestContext extends ModelTestContext<NotificationTaskBot, NotificationTaskBotDocument> {
  /**
   * Key of the model the bot is attached to.
   */
  get modelKey(): FirestoreModelKey;
  /**
   * Owner passed on every ensure.
   */
  get owner(): Maybe<FirebaseAuthOwnershipKey>;
  /**
   * The helpers' default entry.
   */
  get defaultEntryId(): Maybe<NotificationTaskBotEntryId>;
  loadBot(): Promise<Maybe<NotificationTaskBot>>;
  loadEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry<D>>>;
  assertEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<NotificationTaskBotEmbeddedScriptEntry<D>>;
  loadRunTaskDocument(taskKey: NotificationTaskKey): NotificationDocument;
  loadRunTask(taskKey: NotificationTaskKey): Promise<Maybe<Notification>>;
  loadLiveRunTask(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<Notification>>;
  ensure<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(input: NotificationTaskBotTestContextEntryInput<EnsureNotificationTaskBotEntryInput<D>>): Promise<ApplyNotificationTaskBotChangesInTransactionResult>;
  applyChanges(input: Omit<ApplyNotificationTaskBotChangesInput, 'model'>): Promise<ApplyNotificationTaskBotChangesInTransactionResult>;
  schedule(input?: Maybe<NotificationTaskBotTestContextEntryInput<ScheduleNotificationTaskBotEntryInput>>): Promise<ApplyNotificationTaskBotChangesInTransactionResult>;
  sendRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<SendNotificationTaskBotRunInput>>): Promise<SendNotificationTaskBotRunResult>;
  sendQueuedNotifications(params?: Maybe<SendQueuedNotificationsParams>): Promise<SendQueuedNotificationsResult>;
  exhaustRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<ExhaustNotificationTaskBotRunInput>>): Promise<ExhaustNotificationTaskBotRunResult>;
  repairAt(input?: Maybe<Omit<RepairNotificationTaskBotsAtInput, 'context'>>): Promise<RepairAllNotificationTaskBotsResult>;
  stallRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<StallNotificationTaskBotRunInput>>): Promise<StallNotificationTaskBotRunResult>;
  expectStatus(status: NotificationTaskBotEntryStatus, entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry>>;
  expectHistory(expected: NotificationTaskBotEntryHistoryExpectation[], entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry>>;
}

/**
 * Test context instance for a NotificationTaskBot attached to a model.
 */
export class NotificationTaskBotTestContextInstance<PI extends NotificationTaskBotTestContextParentInstance = NotificationTaskBotTestContextParentInstance> extends ModelTestContextInstance<NotificationTaskBot, NotificationTaskBotDocument, PI> implements NotificationTaskBotTestContext {
  private readonly _modelKey: FirestoreModelKey;
  private readonly _owner: Maybe<FirebaseAuthOwnershipKey>;
  private readonly _defaultEntryId: Maybe<NotificationTaskBotEntryId>;

  constructor(config: NotificationTaskBotTestContextInstanceConfig<PI>) {
    super(config.collection, config.ref, config.testContext);
    this._modelKey = config.modelKey;
    this._owner = config.owner;
    this._defaultEntryId = config.defaultEntryId;
  }

  get modelKey(): FirestoreModelKey {
    return this._modelKey;
  }

  get owner(): Maybe<FirebaseAuthOwnershipKey> {
    return this._owner;
  }

  get defaultEntryId(): Maybe<NotificationTaskBotEntryId> {
    return this._defaultEntryId;
  }

  /**
   * Returns the entry id to use.
   *
   * @param entryId - The entry id passed to a helper, if any.
   * @returns The entry id, or the default entry id.
   * @throws {Error} When neither is set.
   */
  entryIdOrDefault(entryId?: Maybe<NotificationTaskBotEntryId>): NotificationTaskBotEntryId {
    const result = entryId ?? this._defaultEntryId;

    if (!result) {
      throw new Error('NotificationTaskBotTestContextInstance: no entry id. Pass entryId, or set entryId or entries on the context params.');
    }

    return result;
  }

  private _entryRef(entryId?: Maybe<NotificationTaskBotEntryId>) {
    return { context: this.testContext, model: this._modelKey, entryId: this.entryIdOrDefault(entryId) };
  }

  loadBot(): Promise<Maybe<NotificationTaskBot>> {
    return loadNotificationTaskBot({ context: this.testContext, model: this._modelKey });
  }

  loadEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry<D>>> {
    return loadNotificationTaskBotEntry<D>(this._entryRef(entryId));
  }

  assertEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<NotificationTaskBotEmbeddedScriptEntry<D>> {
    return assertNotificationTaskBotEntry<D>(this._entryRef(entryId));
  }

  loadRunTaskDocument(taskKey: NotificationTaskKey): NotificationDocument {
    return loadNotificationTaskBotRunTaskDocument({ context: this.testContext, taskKey });
  }

  loadRunTask(taskKey: NotificationTaskKey): Promise<Maybe<Notification>> {
    return loadNotificationTaskBotRunTask({ context: this.testContext, taskKey });
  }

  loadLiveRunTask(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<Notification>> {
    return loadNotificationTaskBotLiveRunTask(this._entryRef(entryId));
  }

  ensure<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(input: NotificationTaskBotTestContextEntryInput<EnsureNotificationTaskBotEntryInput<D>>): Promise<ApplyNotificationTaskBotChangesInTransactionResult> {
    const owner = input.owner === undefined ? this._owner : input.owner;
    return ensureNotificationTaskBotEntryFactory(this.testContext.serverActionsContext)<D>({ ...input, owner, model: this._modelKey, entryId: this.entryIdOrDefault(input.entryId) });
  }

  applyChanges(input: Omit<ApplyNotificationTaskBotChangesInput, 'model'>): Promise<ApplyNotificationTaskBotChangesInTransactionResult> {
    return applyNotificationTaskBotChangesFactory(this.testContext.serverActionsContext)({ ...input, model: this._modelKey });
  }

  schedule(input?: Maybe<NotificationTaskBotTestContextEntryInput<ScheduleNotificationTaskBotEntryInput>>): Promise<ApplyNotificationTaskBotChangesInTransactionResult> {
    return scheduleNotificationTaskBotEntryFactory(this.testContext.serverActionsContext)({ ...input, model: this._modelKey, entryId: this.entryIdOrDefault(input?.entryId) });
  }

  sendRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<SendNotificationTaskBotRunInput>>): Promise<SendNotificationTaskBotRunResult> {
    return sendNotificationTaskBotRun({ ...input, ...this._entryRef(input?.entryId) });
  }

  async sendQueuedNotifications(params?: Maybe<SendQueuedNotificationsParams>): Promise<SendQueuedNotificationsResult> {
    const sendQueuedNotifications = await this.testContext.notificationServerActions.sendQueuedNotifications(params ?? {});
    return sendQueuedNotifications();
  }

  exhaustRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<ExhaustNotificationTaskBotRunInput>>): Promise<ExhaustNotificationTaskBotRunResult> {
    return exhaustNotificationTaskBotRun({ ...input, ...this._entryRef(input?.entryId) });
  }

  repairAt(input?: Maybe<Omit<RepairNotificationTaskBotsAtInput, 'context'>>): Promise<RepairAllNotificationTaskBotsResult> {
    return repairNotificationTaskBotsAt({ ...input, context: this.testContext });
  }

  stallRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<StallNotificationTaskBotRunInput>>): Promise<StallNotificationTaskBotRunResult> {
    return stallNotificationTaskBotRun({ ...input, ...this._entryRef(input?.entryId) });
  }

  async expectStatus(status: NotificationTaskBotEntryStatus, entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry>> {
    const entry = await this.loadEntry(entryId);
    expectNotificationTaskBotEntryStatus(entry, status);
    return entry;
  }

  async expectHistory(expected: NotificationTaskBotEntryHistoryExpectation[], entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry>> {
    const entry = await this.loadEntry(entryId);
    expectNotificationTaskBotEntryHistory(entry, expected);
    return entry;
  }
}

/**
 * Test context fixture for a NotificationTaskBot attached to a model. Forwards to its {@link NotificationTaskBotTestContextInstance}.
 */
export class NotificationTaskBotTestContextFixture<PI extends NotificationTaskBotTestContextParentInstance = NotificationTaskBotTestContextParentInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends NotificationTaskBotTestContextInstance<PI> = NotificationTaskBotTestContextInstance<PI>>
  extends ModelTestContextFixture<NotificationTaskBot, NotificationTaskBotDocument, PI, PF, I>
  implements NotificationTaskBotTestContext
{
  // MARK: NotificationTaskBotTestContext (Forwarded)
  get modelKey(): FirestoreModelKey {
    return this.instance.modelKey;
  }

  get owner(): Maybe<FirebaseAuthOwnershipKey> {
    return this.instance.owner;
  }

  get defaultEntryId(): Maybe<NotificationTaskBotEntryId> {
    return this.instance.defaultEntryId;
  }

  loadBot(): Promise<Maybe<NotificationTaskBot>> {
    return this.instance.loadBot();
  }

  loadEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry<D>>> {
    return this.instance.loadEntry<D>(entryId);
  }

  assertEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<NotificationTaskBotEmbeddedScriptEntry<D>> {
    return this.instance.assertEntry<D>(entryId);
  }

  loadRunTaskDocument(taskKey: NotificationTaskKey): NotificationDocument {
    return this.instance.loadRunTaskDocument(taskKey);
  }

  loadRunTask(taskKey: NotificationTaskKey): Promise<Maybe<Notification>> {
    return this.instance.loadRunTask(taskKey);
  }

  loadLiveRunTask(entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<Notification>> {
    return this.instance.loadLiveRunTask(entryId);
  }

  ensure<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(input: NotificationTaskBotTestContextEntryInput<EnsureNotificationTaskBotEntryInput<D>>): Promise<ApplyNotificationTaskBotChangesInTransactionResult> {
    return this.instance.ensure<D>(input);
  }

  applyChanges(input: Omit<ApplyNotificationTaskBotChangesInput, 'model'>): Promise<ApplyNotificationTaskBotChangesInTransactionResult> {
    return this.instance.applyChanges(input);
  }

  schedule(input?: Maybe<NotificationTaskBotTestContextEntryInput<ScheduleNotificationTaskBotEntryInput>>): Promise<ApplyNotificationTaskBotChangesInTransactionResult> {
    return this.instance.schedule(input);
  }

  sendRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<SendNotificationTaskBotRunInput>>): Promise<SendNotificationTaskBotRunResult> {
    return this.instance.sendRun(input);
  }

  sendQueuedNotifications(params?: Maybe<SendQueuedNotificationsParams>): Promise<SendQueuedNotificationsResult> {
    return this.instance.sendQueuedNotifications(params);
  }

  exhaustRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<ExhaustNotificationTaskBotRunInput>>): Promise<ExhaustNotificationTaskBotRunResult> {
    return this.instance.exhaustRun(input);
  }

  repairAt(input?: Maybe<Omit<RepairNotificationTaskBotsAtInput, 'context'>>): Promise<RepairAllNotificationTaskBotsResult> {
    return this.instance.repairAt(input);
  }

  stallRun(input?: Maybe<NotificationTaskBotTestContextEntryInput<StallNotificationTaskBotRunInput>>): Promise<StallNotificationTaskBotRunResult> {
    return this.instance.stallRun(input);
  }

  expectStatus(status: NotificationTaskBotEntryStatus, entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry>> {
    return this.instance.expectStatus(status, entryId);
  }

  expectHistory(expected: NotificationTaskBotEntryHistoryExpectation[], entryId?: Maybe<NotificationTaskBotEntryId>): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry>> {
    return this.instance.expectHistory(expected, entryId);
  }
}

// MARK: Factory
/**
 * Config for {@link notificationTaskBotTestContextFactory}. Without either function the library classes are used.
 */
export interface NotificationTaskBotTestContextFactoryConfig<
  PI extends NotificationTaskBotTestContextParentInstance = NotificationTaskBotTestContextParentInstance,
  PF extends TestContextFixture<PI> = TestContextFixture<PI>,
  I extends NotificationTaskBotTestContextInstance<PI> = NotificationTaskBotTestContextInstance<PI>,
  F extends NotificationTaskBotTestContextFixture<PI, PF, I> = NotificationTaskBotTestContextFixture<PI, PF, I>
> {
  readonly makeFixture?: (parent: PF) => F;
  readonly makeInstance?: (config: NotificationTaskBotTestContextInstanceConfig<PI>) => PromiseOrValue<I>;
}

/**
 * Creates a test context factory for the NotificationTaskBot attached to a model. The bot's id comes from the attached
 * model's key, and the bot is created by ensuring the params' `entries`, in order.
 *
 * Apps subclass the fixture and instance and register them, like {@link authorizedUserContextFactory}.
 *
 * @param config - Optional fixture and instance constructors.
 * @returns Wires the context into the active test context, given the params and a `buildTests` callback.
 *
 * @example
 * ```ts
 * export const myNotificationTaskBotContext = notificationTaskBotTestContextFactory<MyApiFunctionContextFixtureInstance, MyApiFunctionContextFixture, MyApiNotificationTaskBotTestContextInstance, MyApiNotificationTaskBotTestContextFixture>({
 *   makeFixture: (f) => new MyApiNotificationTaskBotTestContextFixture(f),
 *   makeInstance: (config) => new MyApiNotificationTaskBotTestContextInstance(config)
 * });
 *
 * myNotificationTaskBotContext({ f, for: p, owner: p, entries: [{ entryId, scriptType }] }, (ntb) => {
 *   it('should run', async () => {
 *     await ntb.sendRun({ untilDone: true });
 *     await ntb.expectHistory([NotificationTaskBotRunOutcome.SUBMITTED]);
 *   });
 * });
 * ```
 */
export function notificationTaskBotTestContextFactory<
  PI extends NotificationTaskBotTestContextParentInstance = NotificationTaskBotTestContextParentInstance,
  PF extends TestContextFixture<PI> = TestContextFixture<PI>,
  I extends NotificationTaskBotTestContextInstance<PI> = NotificationTaskBotTestContextInstance<PI>,
  F extends NotificationTaskBotTestContextFixture<PI, PF, I> = NotificationTaskBotTestContextFixture<PI, PF, I>
>(config?: Maybe<NotificationTaskBotTestContextFactoryConfig<PI, PF, I, F>>): (params: NotificationTaskBotTestContextFactoryParams<PF>, buildTests: (ntb: F) => void) => void {
  const makeFixture = config?.makeFixture ?? ((f: PF) => new NotificationTaskBotTestContextFixture<PI, PF, I>(f) as F);
  const makeInstance = config?.makeInstance ?? ((instanceConfig: NotificationTaskBotTestContextInstanceConfig<PI>) => new NotificationTaskBotTestContextInstance<PI>(instanceConfig) as I);

  return (params: NotificationTaskBotTestContextFactoryParams<PF>, buildTests: (ntb: F) => void) => {
    const { owner: paramsOwner, entries, entryId } = params;
    const defaultEntryId = entryId ?? entries?.[0]?.entryId;

    const factory = modelTestContextFactory<NotificationTaskBot, NotificationTaskBotDocument, NotificationTaskBotTestContextFactoryParams<PF>, PI, PF, I, F, NotificationTaskBotFirestoreCollection>({
      makeFixture,
      getCollection: (pi) => pi.serverActionsContext.notificationTaskBotCollection,
      makeRef: async (collection) => collection.documentAccessor().loadDocumentForId(notificationTaskBotIdForModel(params.for.documentKey)).documentRef,
      makeInstance: (collection, ref, testContext) => {
        const owner = typeof paramsOwner === 'string' ? paramsOwner : paramsOwner?.documentKey;
        return makeInstance({ collection: collection as NotificationTaskBotFirestoreCollection, ref, testContext, modelKey: params.for.documentKey, owner, defaultEntryId });
      },
      initDocument: async (instance) => {
        for (const entry of entries ?? []) {
          await instance.ensure(entry);
        }
      }
    });

    factory(params, buildTests);
  };
}
