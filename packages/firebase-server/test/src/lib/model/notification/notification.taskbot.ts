import {
  getDocumentSnapshotData,
  type FirestoreModelKey,
  type Notification,
  type NotificationDocument,
  NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS,
  type NotificationTaskBot,
  type NotificationTaskBotEmbeddedScriptEntry,
  notificationTaskBotEntry,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntryId,
  notificationTaskBotIdForModel,
  type NotificationTaskBotRunNotificationTaskData,
  type NotificationTaskBotScheduleChange,
  type NotificationTaskKey,
  type RepairAllNotificationTaskBotsResult,
  type SendNotificationResult
} from '@dereekb/firebase';
import { DEFAULT_NOTIFICATION_TASK_BOT_REPAIR_OVERDUE_THRESHOLD, type NotificationServerActions, type NotificationTaskBotServerActionsContext, type RepairAllNotificationTaskBotsParams, scheduleNotificationTaskBotEntryFactory } from '@dereekb/firebase-server/model';
import { iterablesAreSetEquivalent, type Maybe, type Milliseconds } from '@dereekb/util';

// MARK: Context
/**
 * The server-side pieces the NotificationTaskBot test helpers drive. An app's function test context (the fixture `f` or its
 * instance) satisfies it as-is when it exposes these two getters.
 */
export interface NotificationTaskBotTestServerContext {
  /**
   * The app's server actions context. Must carry the NotificationTaskBot collection and the app's script registry.
   */
  readonly serverActionsContext: NotificationTaskBotServerActionsContext;
  /**
   * Sends run tasks the way the send queue does, and runs the repair sweep.
   */
  readonly notificationServerActions: Pick<NotificationServerActions, 'sendNotification' | 'sendQueuedNotifications' | 'repairAllNotificationTaskBots'>;
}

/**
 * References a NotificationTaskBot by the model it is attached to.
 */
export interface NotificationTaskBotTestModelRef {
  readonly context: NotificationTaskBotTestServerContext;
  /**
   * Key of the model the bot is attached to (the server helpers' `model`).
   */
  readonly model: FirestoreModelKey;
}

/**
 * References one entry of a NotificationTaskBot.
 */
export interface NotificationTaskBotTestEntryRef extends NotificationTaskBotTestModelRef {
  readonly entryId: NotificationTaskBotEntryId;
}

/**
 * References one run task of a NotificationTaskBot.
 */
export interface NotificationTaskBotTestRunTaskRef {
  readonly context: NotificationTaskBotTestServerContext;
  readonly taskKey: NotificationTaskKey;
}

/**
 * How far ahead of now {@link repairNotificationTaskBotsAt} runs the sweep by default: twice the default overdue threshold
 * (two hours), so every run due within the next hour is overdue.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_TEST_REPAIR_OFFSET: Milliseconds = DEFAULT_NOTIFICATION_TASK_BOT_REPAIR_OVERDUE_THRESHOLD * 2;

// MARK: Pure
/**
 * Returns the key of the entry's live run task.
 *
 * @param bot - The bot, if it exists.
 * @param entryId - The entry to read.
 * @returns The entry's `nk`, or undefined when the bot, the entry or its live run is missing.
 */
export function notificationTaskBotLiveRunTaskKey(bot: Maybe<Pick<NotificationTaskBot, 'e'>>, entryId: NotificationTaskBotEntryId): Maybe<NotificationTaskKey> {
  return notificationTaskBotEntry(bot, entryId)?.nk ?? undefined;
}

/**
 * Returns a run task's NotificationTaskBot data.
 *
 * @param task - The run task, if it exists.
 * @returns The task's `n.d`, typed as run data.
 */
export function notificationTaskBotRunTaskData(task: Maybe<{ readonly n: { readonly d?: unknown } }>): Maybe<NotificationTaskBotRunNotificationTaskData> {
  return task?.n.d as Maybe<NotificationTaskBotRunNotificationTaskData>;
}

// MARK: Loaders
/**
 * Loads the NotificationTaskBot attached to the model.
 *
 * @param input - The bot to load.
 * @returns The bot's data, or undefined when it does not exist.
 */
export function loadNotificationTaskBot(input: NotificationTaskBotTestModelRef): Promise<Maybe<NotificationTaskBot>> {
  const { context, model } = input;
  const botDocument = context.serverActionsContext.notificationTaskBotCollection.documentAccessor().loadDocumentForId(notificationTaskBotIdForModel(model));
  return getDocumentSnapshotData(botDocument);
}

/**
 * Loads one entry of the NotificationTaskBot attached to the model.
 *
 * @param input - The entry to load.
 * @returns The entry, or undefined when the bot or the entry does not exist.
 */
export async function loadNotificationTaskBotEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(input: NotificationTaskBotTestEntryRef): Promise<Maybe<NotificationTaskBotEmbeddedScriptEntry<D>>> {
  return notificationTaskBotEntry<D>(await loadNotificationTaskBot(input), input.entryId);
}

/**
 * Loads one entry of the NotificationTaskBot attached to the model, and throws when it is missing.
 *
 * @param input - The entry to load.
 * @returns The entry.
 * @throws {Error} When the bot or the entry does not exist.
 */
export async function assertNotificationTaskBotEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(input: NotificationTaskBotTestEntryRef): Promise<NotificationTaskBotEmbeddedScriptEntry<D>> {
  const { model, entryId } = input;
  const bot = await loadNotificationTaskBot(input);

  if (!bot) {
    throw new Error(`assertNotificationTaskBotEntry(): no NotificationTaskBot exists for model "${model}".`);
  }

  const entry = notificationTaskBotEntry<D>(bot, entryId);

  if (!entry) {
    throw new Error(`assertNotificationTaskBotEntry(): the NotificationTaskBot for model "${model}" has no entry "${entryId}".`);
  }

  return entry;
}

/**
 * Returns the document of a run task, for direct writes such as `accessor.delete()`.
 *
 * @param input - The run task.
 * @returns The task's NotificationDocument.
 */
export function loadNotificationTaskBotRunTaskDocument(input: NotificationTaskBotTestRunTaskRef): NotificationDocument {
  return input.context.serverActionsContext.notificationCollectionGroup.documentAccessor().loadDocumentForKey(input.taskKey);
}

/**
 * Loads a run task.
 *
 * @param input - The run task.
 * @returns The task's data, or undefined when it does not exist.
 */
export function loadNotificationTaskBotRunTask(input: NotificationTaskBotTestRunTaskRef): Promise<Maybe<Notification>> {
  return getDocumentSnapshotData(loadNotificationTaskBotRunTaskDocument(input));
}

/**
 * Loads the task of the entry's live run.
 *
 * @param input - The entry.
 * @returns The live run's task data, or undefined when the entry is idle or its task is gone.
 */
export async function loadNotificationTaskBotLiveRunTask(input: NotificationTaskBotTestEntryRef): Promise<Maybe<Notification>> {
  const taskKey = notificationTaskBotLiveRunTaskKey(await loadNotificationTaskBot(input), input.entryId);
  return taskKey ? loadNotificationTaskBotRunTask({ context: input.context, taskKey }) : undefined;
}

// MARK: Send
/**
 * Default for {@link SendNotificationTaskBotRunInput.maxSends}.
 */
export const DEFAULT_SEND_NOTIFICATION_TASK_BOT_RUN_MAX_SENDS = 10;

/**
 * The schedule fields {@link SendNotificationTaskBotRunInput.schedule} accepts.
 */
export type SendNotificationTaskBotRunSchedule = Omit<NotificationTaskBotScheduleChange, 'type' | 'entryId'>;

/**
 * Input for {@link sendNotificationTaskBotRun}.
 */
export interface SendNotificationTaskBotRunInput extends NotificationTaskBotTestEntryRef {
  /**
   * Sends this task instead of the entry's live run, e.g. a stale or recreated run.
   */
  readonly taskKey?: Maybe<NotificationTaskKey>;
  /**
   * First supersedes the live run with a new run, then sends that run. `true` is a SCHEDULED run due now.
   */
  readonly schedule?: Maybe<true | SendNotificationTaskBotRunSchedule>;
  /**
   * Keeps sending while each send moves the run forward, until it is done or deleted.
   */
  readonly untilDone?: Maybe<boolean>;
  /**
   * Defaults to {@link DEFAULT_SEND_NOTIFICATION_TASK_BOT_RUN_MAX_SENDS}. Only read with {@link untilDone}.
   */
  readonly maxSends?: Maybe<number>;
}

/**
 * Result of {@link sendNotificationTaskBotRun}.
 */
export interface SendNotificationTaskBotRunResult {
  readonly taskKey: NotificationTaskKey;
  /**
   * One result per send, in order.
   */
  readonly sendResults: SendNotificationResult[];
  /**
   * The last send's result.
   */
  readonly sendResult: SendNotificationResult;
  /**
   * The run's task after the last send. Undefined when the task was deleted.
   */
  readonly task: Maybe<Notification>;
  /**
   * True when the run's task is done.
   */
  readonly done: boolean;
  /**
   * True when the run's task was deleted.
   */
  readonly deleted: boolean;
  /**
   * The entry after the last send. Undefined when the run's cleanup removed it.
   */
  readonly entry: Maybe<NotificationTaskBotEmbeddedScriptEntry>;
}

/**
 * Sends one run task the way the send queue does, ignoring the send-at throttle.
 *
 * @param input - The run task.
 * @returns The send result.
 */
export async function sendNotificationTaskBotRunTask(input: NotificationTaskBotTestRunTaskRef): Promise<SendNotificationResult> {
  const send = await input.context.notificationServerActions.sendNotification({ key: input.taskKey, ignoreSendAtThrottle: true });
  return send(loadNotificationTaskBotRunTaskDocument(input));
}

/**
 * Whether a send moved a run forward: a part boundary or a completed step changes the task's `tpr` or its data's `sfps`. A
 * delay, the due check, the start gate or a poll changes neither. A missing array counts as empty, since a fresh task's
 * first send writes an empty `sfps`.
 *
 * @param before - The task before the send.
 * @param after - The task after the send.
 * @returns True when the run progressed.
 */
function notificationTaskBotRunProgressed(before: Maybe<Notification>, after: Notification): boolean {
  return !iterablesAreSetEquivalent(before?.tpr ?? [], after.tpr ?? []) || !iterablesAreSetEquivalent(notificationTaskBotRunTaskData(before)?.sfps ?? [], notificationTaskBotRunTaskData(after)?.sfps ?? []);
}

/**
 * Sends one run of an entry, ignoring the send-at throttle. The run start gate still holds a run that is not due yet, so
 * re-arm with {@link SendNotificationTaskBotRunInput.schedule} (or a FORCED run) to run the next run now.
 *
 * Sends the live run once by default. With `untilDone` it keeps sending while each send moves the run forward, and stops when
 * a send fails, the run is done or deleted, the run waits (a delay, the due check or a poll), or `maxSends` is reached.
 *
 * @param input - The entry and the run to send.
 * @returns The sends' results, the task and the entry afterwards.
 * @throws {Error} When `schedule` created no run, or the entry has no live run and no `taskKey` is passed.
 *
 * @example
 * ```ts
 * const run = await sendNotificationTaskBotRun({ context: f, model: p.documentKey, entryId, schedule: true, untilDone: true });
 * expect(run.done).toBe(true);
 * ```
 */
export async function sendNotificationTaskBotRun(input: SendNotificationTaskBotRunInput): Promise<SendNotificationTaskBotRunResult> {
  const { context, model, entryId, schedule, untilDone, maxSends: inputMaxSends } = input;
  let taskKey: Maybe<NotificationTaskKey>;

  if (schedule) {
    const scheduleInput = schedule === true ? {} : schedule;
    const scheduled = await scheduleNotificationTaskBotEntryFactory(context.serverActionsContext)({ ...scheduleInput, model, entryId });
    taskKey = scheduled.createRuns[0]?.taskKey;

    if (!taskKey) {
      throw new Error(`sendNotificationTaskBotRun(): scheduling entry "${entryId}" of model "${model}" created no run. The entry may be disabled, paused or opted out.`);
    }
  } else {
    taskKey = input.taskKey ?? (await assertNotificationTaskBotEntry(input)).nk;

    if (!taskKey) {
      throw new Error(`sendNotificationTaskBotRun(): entry "${entryId}" of model "${model}" has no live run. Pass schedule or ensure the entry first.`);
    }
  }

  const taskRef: NotificationTaskBotTestRunTaskRef = { context, taskKey };
  const maxSends = untilDone ? (inputMaxSends ?? DEFAULT_SEND_NOTIFICATION_TASK_BOT_RUN_MAX_SENDS) : 1;
  const sendResults: SendNotificationResult[] = [];

  let task = await loadNotificationTaskBotRunTask(taskRef);
  let keepSending = true;

  while (keepSending) {
    const before = task;
    const sendResult = await sendNotificationTaskBotRunTask(taskRef);
    sendResults.push(sendResult);
    task = await loadNotificationTaskBotRunTask(taskRef);
    keepSending = sendResults.length < maxSends && sendResult.success && task != null && !task.d && notificationTaskBotRunProgressed(before, task);
  }

  return { taskKey, sendResults, sendResult: sendResults[sendResults.length - 1], task, done: task?.d === true, deleted: task == null, entry: await loadNotificationTaskBotEntry(input) };
}

// MARK: Exhaust
/**
 * Input for {@link exhaustNotificationTaskBotRun}.
 */
export interface ExhaustNotificationTaskBotRunInput extends NotificationTaskBotTestEntryRef {
  /**
   * Exhausts this task instead of the entry's live run.
   */
  readonly taskKey?: Maybe<NotificationTaskKey>;
}

/**
 * Result of {@link exhaustNotificationTaskBotRun}.
 */
export interface ExhaustNotificationTaskBotRunResult {
  readonly taskKey: NotificationTaskKey;
  readonly sendResult: SendNotificationResult;
}

/**
 * Drives a run to deletion: sets its task's attempts to the limit and sends it once, so the send runner deletes it.
 *
 * It does not repair. Call {@link repairNotificationTaskBotsAt} afterwards to record the run as LOST.
 *
 * @param input - The entry and, optionally, the run to exhaust.
 * @returns The task key and the send's result.
 * @throws {Error} When the entry has no live run and no `taskKey` is passed, or the task survives the send.
 */
export async function exhaustNotificationTaskBotRun(input: ExhaustNotificationTaskBotRunInput): Promise<ExhaustNotificationTaskBotRunResult> {
  const { context, model, entryId } = input;
  const taskKey = input.taskKey ?? (await assertNotificationTaskBotEntry(input)).nk;

  if (!taskKey) {
    throw new Error(`exhaustNotificationTaskBotRun(): entry "${entryId}" of model "${model}" has no live run.`);
  }

  const taskRef: NotificationTaskBotTestRunTaskRef = { context, taskKey };
  await loadNotificationTaskBotRunTaskDocument(taskRef).update({ a: NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS });
  const sendResult = await sendNotificationTaskBotRunTask(taskRef);

  if ((await loadNotificationTaskBotRunTask(taskRef)) != null) {
    throw new Error(`exhaustNotificationTaskBotRun(): the run task "${taskKey}" still exists after reaching the attempt limit.`);
  }

  return { taskKey, sendResult };
}

// MARK: Repair
/**
 * Input for {@link repairNotificationTaskBotsAt}.
 */
export interface RepairNotificationTaskBotsAtInput extends RepairAllNotificationTaskBotsParams {
  readonly context: NotificationTaskBotTestServerContext;
}

/**
 * Runs the repair sweep as if it were later.
 *
 * @param input - The context, and the sweep's `now` and `overdueThreshold`. `now` defaults to now plus {@link DEFAULT_NOTIFICATION_TASK_BOT_TEST_REPAIR_OFFSET}.
 * @returns The sweep's result.
 */
export function repairNotificationTaskBotsAt(input: RepairNotificationTaskBotsAtInput): Promise<RepairAllNotificationTaskBotsResult> {
  const { context, now, overdueThreshold } = input;
  return context.notificationServerActions.repairAllNotificationTaskBots({ now: now ?? new Date(Date.now() + DEFAULT_NOTIFICATION_TASK_BOT_TEST_REPAIR_OFFSET), overdueThreshold });
}

// MARK: Stall
/**
 * How {@link stallNotificationTaskBotRun} makes the live run stalled:
 * - `'failing'`: the task gets a failed attempt;
 * - `'unpicked'`: the task is left alone, as if nothing picked it up.
 */
export type StallNotificationTaskBotRunMode = 'failing' | 'unpicked';

/**
 * Input for {@link stallNotificationTaskBotRun}.
 */
export interface StallNotificationTaskBotRunInput extends NotificationTaskBotTestEntryRef {
  /**
   * Defaults to `'failing'`.
   */
  readonly mode?: Maybe<StallNotificationTaskBotRunMode>;
}

/**
 * Result of {@link stallNotificationTaskBotRun}.
 */
export interface StallNotificationTaskBotRunResult {
  readonly taskKey: NotificationTaskKey;
  /**
   * The `now` the repair sweep ran at.
   */
  readonly repairedAt: Date;
  readonly repairResult: RepairAllNotificationTaskBotsResult;
  /**
   * The entry after the sweep.
   */
  readonly entry: NotificationTaskBotEmbeddedScriptEntry;
}

/**
 * Makes the entry's live run look stalled, then runs the repair sweep far enough ahead that the sweep marks it (`stl`).
 *
 * A pending task is stalled when it has failed attempts, or when its send time is past the sweep's overdue threshold.
 *
 * @param input - The entry and the stall mode.
 * @returns The task key, the sweep's time and result, and the entry afterwards.
 * @throws {Error} When the entry has no live run, or its task is missing or done.
 */
export async function stallNotificationTaskBotRun(input: StallNotificationTaskBotRunInput): Promise<StallNotificationTaskBotRunResult> {
  const { context, model, entryId, mode = 'failing' } = input;
  const entry = await assertNotificationTaskBotEntry(input);
  const taskKey = entry.nk;

  if (!taskKey) {
    throw new Error(`stallNotificationTaskBotRun(): entry "${entryId}" of model "${model}" has no live run.`);
  }

  const taskRef: NotificationTaskBotTestRunTaskRef = { context, taskKey };
  const task = await loadNotificationTaskBotRunTask(taskRef);

  if (!task || task.d) {
    throw new Error(`stallNotificationTaskBotRun(): the live run task "${taskKey}" of entry "${entryId}" is not pending.`);
  }

  if (mode === 'failing' && task.a < 1) {
    await loadNotificationTaskBotRunTaskDocument(taskRef).update({ a: 1 });
  }

  const latest = Math.max(entry.nat?.getTime() ?? 0, task.sat.getTime(), Date.now());
  const repairedAt = new Date(latest + DEFAULT_NOTIFICATION_TASK_BOT_TEST_REPAIR_OFFSET);
  const repairResult = await repairNotificationTaskBotsAt({ context, now: repairedAt });

  return { taskKey, repairedAt, repairResult, entry: await assertNotificationTaskBotEntry(input) };
}
