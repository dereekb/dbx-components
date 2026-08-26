import { SCHEDULER_SYSTEM_STATE_TYPE, type FirestoreDocument, type SchedulerSystemData, type SystemState, type SystemStateFirestoreCollectionLike, type SystemStateStoredData, hasRunInCurrentHour, isNthHourOfDay, loadSchedulerSystemState } from '@dereekb/firebase';
import { type Getter, type Hours, type Maybe, isDate } from '@dereekb/util';

/**
 * A read of the scheduler's gate state, taken at a single moment.
 *
 * Holds the `now` it was read at, so {@link SchedulerSystemStateRead.isOpen} can be asked about any
 * number of `everyNHours` values without re-reading the document or drifting across an hour boundary
 * mid-evaluation.
 */
export interface SchedulerSystemStateRead {
  /**
   * The moment the most recent passing check claimed its hour, or null if the gate has never been
   * claimed.
   */
  readonly lastRunAt: Maybe<Date>;
  /**
   * Whether the gate is open for the given interval: `now` is an Nth hour of the day AND
   * {@link lastRunAt} is not already inside the current hour.
   *
   * This is a pure evaluation — it does NOT claim the hour. Use
   * {@link SchedulerSystemStateAccessor.checkAndClaim} to actually gate work.
   *
   * @param everyNHours - Run every Nth hour of the day.
   * @returns True when the gate is open.
   */
  isOpen(everyNHours: Hours): boolean;
}

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
   * The claim is stamped BEFORE this resolves `true`, deliberately: a crash or a function timeout in
   * the caller's work must still cost the whole window. Otherwise the hourly cron degrades into an
   * hourly retry loop against work that is already failing.
   *
   * Remember that one gate is one `lat`. Two callers with different `everyNHours` sharing the
   * document will have whichever one passes first claim the hour for BOTH — the second gets `false`
   * even if its own interval matched. That is the intended semantics of a single gate, but it is the
   * thing a future second caller will trip over.
   *
   * @param config - The interval to evaluate.
   * @returns True when the caller may run its work.
   */
  checkAndClaim(config: SchedulerSystemStateGateConfig): Promise<boolean>;
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
 * whole, off the single `lat` on the `sys/scheduler` document. Evaluate it ONCE at the top of a
 * schedule function; the individual tasks it guards carry no throttle of their own.
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
 *   if (!(await schedulerSystemState.checkAndClaim({ everyNHours: 3 }))) {
 *     return;
 *   }
 *
 *   await doTheWork();
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
        const lastRunAt = assertSchedulerLastRunAt(existingData?.data.lat);
        const now = nowFactory();

        return {
          lastRunAt,
          // Closes over the single `now` above so every interval is answered against the same
          // moment - asking about 2 and then 3 cannot straddle an hour boundary.
          isOpen: (everyNHours: Hours) => isNthHourOfDay(everyNHours, now) && !hasRunInCurrentHour(lastRunAt, now)
        };
      },
      checkAndClaim: async ({ everyNHours }) => {
        return systemStateCollection.firestoreContext.runTransaction(async (transaction) => {
          const now = nowFactory();
          const documentInTransaction = loadSchedulerSystemState(systemStateCollection.documentAccessorForTransaction(transaction));
          const existingData = await documentInTransaction.snapshotData();
          const lastRunAt = assertSchedulerLastRunAt(existingData?.data.lat);
          const isOpen = isNthHourOfDay(everyNHours, now) && !hasRunInCurrentHour(lastRunAt, now);

          if (isOpen) {
            const templateOrUpdate: SystemState<SchedulerSystemData> = {
              data: {
                lat: now
              }
            };

            // Claim the window BEFORE returning true, so the caller's work has not started yet.
            if (existingData) {
              await documentInTransaction.update(templateOrUpdate);
            } else {
              await documentInTransaction.create(templateOrUpdate);
            }
          }

          return isOpen;
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
