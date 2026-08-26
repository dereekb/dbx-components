import { SCHEDULER_SYSTEM_STATE_TYPE, type FirestoreDocument, type SchedulerSystemData, type SchedulerSystemStateRead, type SystemState, type SystemStateFirestoreCollectionLike, type SystemStateStoredData, loadSchedulerSystemState, schedulerSystemStateRead } from '@dereekb/firebase';
import { type Getter, type Hours, type Maybe, isDate } from '@dereekb/util';

/**
 * Configuration for a single gate evaluation.
 */
export interface SchedulerSystemStateGateConfig {
  /**
   * Run every Nth hour of the day.
   *
   * Matched by modulo against the hour-of-day, so only divisors of 24 divide the day evenly. See
   * `isNthHourOfDay()` in `@dereekb/firebase`.
   */
  readonly everyNHours: Hours;
}

/**
 * The outcome of a {@link SchedulerSystemStateAccessor.checkAndClaim} call.
 *
 * Extends {@link SchedulerSystemStateRead}, so past the pass/fail answer it is also the read the
 * decision was made from: the same `now`, the same hour-of-day, and the same bound predicates. That
 * is what lets a single hourly claim fan out into per-task sub-gates without a second read or a
 * second clock —
 *
 * ```ts
 * const gate = await schedulerSystemState.checkAndClaim({ everyNHours: 1 });
 *
 * if (!gate.claimed) {
 *   return;
 * }
 *
 * await hourlyWork();
 *
 * if (gate.isNthHourOfDay(3)) {
 *   await everyThreeHoursWork();
 * }
 * ```
 *
 * NOTE: this is an object, so it is ALWAYS truthy. `if (await checkAndClaim(...))` always passes —
 * branch on {@link SchedulerSystemStateClaim.claimed}.
 *
 * The inherited {@link SchedulerSystemStateRead} members describe the state as it was read BEFORE
 * the claim was stamped, deliberately: `lastRunAt` is the previous claim, `hasRunInCurrentHour` is
 * false on a successful claim, and `isOpen()` still answers for the other intervals this hour rather
 * than reporting closed against the claim this very call just wrote.
 */
export interface SchedulerSystemStateClaim extends SchedulerSystemStateRead {
  /**
   * The interval the claim was evaluated for.
   */
  readonly everyNHours: Hours;
  /**
   * Whether THIS call claimed the hour, and so whether the caller may run its work.
   */
  readonly claimed: boolean;
  /**
   * The moment stamped as the new `lat`, or null when the gate was closed and nothing was written.
   *
   * Always equal to {@link SchedulerSystemStateRead.now} when {@link claimed} is true.
   */
  readonly claimedAt: Maybe<Date>;
}

/**
 * Reads and claims the scheduler's hourly run gate.
 */
export interface SchedulerSystemStateAccessor {
  /**
   * Reads the gate state without claiming it.
   *
   * @returns The state, which can be evaluated against any number of intervals.
   */
  read(): Promise<SchedulerSystemStateRead>;
  /**
   * Reads, evaluates the gate for the given interval, and CLAIMS the hour, in one transaction.
   *
   * The claim is stamped BEFORE this resolves, deliberately: a crash or a function timeout in the
   * caller's work must still cost the whole window. Otherwise the hourly cron degrades into an
   * hourly retry loop against work that is already failing.
   *
   * Remember that one gate is one `lat`. Two callers with different `everyNHours` sharing the
   * document will have whichever one passes first claim the hour for BOTH — the second gets
   * `claimed: false` even if its own interval matched. That is the intended semantics of a single
   * gate, but it is the thing a future second caller will trip over. Prefer claiming ONCE at the top
   * of the schedule function and sub-gating the individual tasks off the returned
   * {@link SchedulerSystemStateClaim}.
   *
   * @param config - The interval to evaluate.
   * @returns The claim outcome, which also carries the read it was decided from.
   */
  checkAndClaim(config: SchedulerSystemStateGateConfig): Promise<SchedulerSystemStateClaim>;
}

/**
 * Configuration for {@link schedulerSystemStateAccessorFactory}.
 */
export interface SchedulerSystemStateAccessorFactoryConfig {
  /**
   * Clock used to evaluate the gate and to stamp `lat`. Defaults to the current time.
   *
   * Overriding it is what lets a test place "now" at a specific hour-of-day — the gate is a
   * modulo against the hour, so there is otherwise no way to exercise a non-matching hour without
   * waiting for one.
   */
  readonly nowFactory?: Maybe<Getter<Date>>;
}

/**
 * Creates a {@link SchedulerSystemStateAccessor} for a SystemState collection.
 */
export type SchedulerSystemStateAccessorFactory = <D extends FirestoreDocument<SystemState<SystemStateStoredData>>>(systemStateCollection: SystemStateFirestoreCollectionLike<SystemStateStoredData, D>) => SchedulerSystemStateAccessor;

/**
 * Creates a {@link SchedulerSystemStateAccessorFactory}, the Firestore-backed half of the scheduler's
 * hourly run gate.
 *
 * The gate answers "should the scheduler run its Nth-hour body during this hour?" for the app as a
 * whole, off the single `lat` on the `sys/scheduler` document. Claim it ONCE at the top of a
 * schedule function; the individual tasks it guards carry no throttle of their own and sub-gate off
 * the returned {@link SchedulerSystemStateClaim} instead.
 *
 * The collection MUST have `schedulerSystemDataConverter` registered under
 * {@link SCHEDULER_SYSTEM_STATE_TYPE}. Without it the collection falls back to the pass-through
 * converter and `lat` reads back as a raw Firestore `Timestamp`, which no hour comparison can match —
 * so the gate would silently open on every call. {@link SchedulerSystemStateAccessor.read} and
 * `checkAndClaim` throw on that rather than let it through.
 *
 * @param config - The clock override, if any.
 * @returns A factory producing an accessor over a given SystemState collection.
 *
 * @example
 * ```ts
 * const schedulerSystemState = schedulerSystemStateAccessorFactory()(systemStateCollection);
 *
 * export const hourlySchedule: MyScheduleFunction = async (request) => {
 *   const gate = await schedulerSystemState.checkAndClaim({ everyNHours: 1 });
 *
 *   if (!gate.claimed) {
 *     return;
 *   }
 *
 *   await hourlyWork();
 *
 *   if (gate.isNthHourOfDay(3)) {
 *     await everyThreeHoursWork();
 *   }
 * };
 * ```
 */
export function schedulerSystemStateAccessorFactory(config?: Maybe<SchedulerSystemStateAccessorFactoryConfig>): SchedulerSystemStateAccessorFactory {
  const nowFactory = config?.nowFactory ?? (() => new Date());

  return (systemStateCollection) => {
    const systemStateDocumentAccessor = systemStateCollection.documentAccessor();

    const accessor: SchedulerSystemStateAccessor = {
      read: async () => {
        const document = loadSchedulerSystemState(systemStateDocumentAccessor);
        const existingData = await document.snapshotData();

        return schedulerSystemStateRead({ now: nowFactory(), lastRunAt: assertSchedulerLastRunAt(existingData?.data.lat) });
      },
      checkAndClaim: async ({ everyNHours }) => {
        return systemStateCollection.firestoreContext.runTransaction(async (transaction) => {
          const now = nowFactory();
          const documentInTransaction = loadSchedulerSystemState(systemStateCollection.documentAccessorForTransaction(transaction));
          const existingData = await documentInTransaction.snapshotData();
          // Built from the PRE-claim `lat`, so the returned read still answers honestly for the
          // other intervals in this hour rather than closing against the claim written just below.
          const read = schedulerSystemStateRead({ now, lastRunAt: assertSchedulerLastRunAt(existingData?.data.lat) });
          const claimed = read.isOpen(everyNHours);

          if (claimed) {
            const templateOrUpdate: SystemState<SchedulerSystemData> = {
              data: {
                lat: now
              }
            };

            // Claim the window BEFORE returning, so the caller's work has not started yet.
            if (existingData) {
              await documentInTransaction.update(templateOrUpdate);
            } else {
              await documentInTransaction.create(templateOrUpdate);
            }
          }

          return {
            ...read,
            everyNHours,
            claimed,
            claimedAt: claimed ? now : null
          };
        });
      }
    };

    return accessor;
  };
}

/**
 * Guards against the `scheduler` converter not being registered on the collection.
 *
 * An unregistered type falls through to the pass-through converter, which hands back the raw
 * Firestore `Timestamp`. Left alone that reads as "never ran" on every call, which turns the gate
 * into a no-op — a silent failure that looks exactly like a working hourly cron until the bill
 * arrives. Fail loudly instead.
 *
 * @param lat - The raw `lat` value read off the document.
 * @returns The value as a Date, or null when absent.
 * @throws {Error} When `lat` is present but is not a Date, meaning the `scheduler` converter is not registered.
 */
function assertSchedulerLastRunAt(lat: Maybe<Date>): Maybe<Date> {
  if (lat != null && !isDate(lat)) {
    throw new Error(`schedulerSystemStateAccessorFactory(): the "${SCHEDULER_SYSTEM_STATE_TYPE}" SystemState document's "lat" was not a Date. Register schedulerSystemDataConverter() under SCHEDULER_SYSTEM_STATE_TYPE in the collection's SystemStateStoredDataConverterMap.`);
  }

  return lat ?? null;
}
