import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory } from '../../../test/fixture';
import { SCHEDULER_SYSTEM_STATE_TYPE, loadSchedulerSystemState } from '@dereekb/firebase';
import { type SchedulerSystemStateAccessor, schedulerSystemStateAccessorFactory } from '@dereekb/firebase-server/model';
import { isDate } from '@dereekb/util';

/**
 * Emulator coverage for `schedulerSystemStateAccessorFactory()` against the demo app's real
 * `systemStateCollection` — so the `scheduler` converter registered in
 * `demoSystemStateStoredDataConverterMap` is exercised on the real read/write path, not stubbed.
 *
 * Local-time constructor, deliberately: the gate reads the hour-of-day in the ambient timezone, so a
 * `Z`-suffixed literal would make these expectations timezone-dependent.
 */
function dateAtHour(hourOfDay: number, minutes: number = 0): Date {
  return new Date(2024, 0, 15, hourOfDay, minutes, 0, 0);
}

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  function schedulerDocument() {
    return loadSchedulerSystemState(f.instance.demoFirestoreCollections.systemStateCollection.documentAccessor());
  }

  /**
   * @param now - Fixed clock for the accessor, or undefined to use the real one.
   */
  function accessorAtTime(now?: Date): SchedulerSystemStateAccessor {
    return schedulerSystemStateAccessorFactory(now ? { nowFactory: () => now } : undefined)(f.instance.demoFirestoreCollections.systemStateCollection);
  }

  async function readLastRunAt() {
    const data = await schedulerDocument().snapshotData();
    return data?.data.lat;
  }

  describe('schedulerSystemStateAccessorFactory()', () => {
    beforeEach(async () => {
      // One gate is one document, so every case here shares `sys/scheduler` and must start from a
      // known state.
      await schedulerDocument().accessor.delete();
    });

    it('should store the state at the SCHEDULER_SYSTEM_STATE_TYPE document id', async () => {
      await accessorAtTime(dateAtHour(12)).checkAndClaim({ everyNHours: 3 });
      expect(schedulerDocument().id).toBe(SCHEDULER_SYSTEM_STATE_TYPE);
      expect(await readLastRunAt()).toBeDefined();
    });

    describe('checkAndClaim()', () => {
      it('should open the gate for a fresh document', async () => {
        const result = await accessorAtTime(dateAtHour(12)).checkAndClaim({ everyNHours: 3 });
        expect(result.claimed).toBe(true);
      });

      it('should claim the hour before returning, so the callers work has not started yet', async () => {
        // The claim-before-work invariant: a crash or a function timeout in the caller's work must
        // still cost the whole window, or the hourly cron degrades into an hourly retry loop.
        const now = dateAtHour(12, 15);
        const result = await accessorAtTime(now).checkAndClaim({ everyNHours: 3 });

        expect(result.claimed).toBe(true);
        expect(result.claimedAt?.getTime()).toBe(now.getTime());

        const lat = await readLastRunAt();
        expect(isDate(lat)).toBe(true); // registered converter, so a Date and not a raw Timestamp
        expect(lat?.getTime()).toBe(now.getTime());
      });

      it('should close the gate on a second call in the same hour', async () => {
        const accessor = accessorAtTime(dateAtHour(12, 5));
        expect((await accessor.checkAndClaim({ everyNHours: 3 })).claimed).toBe(true);

        // Same hour, later minute - a different call of the same hourly cron.
        expect((await accessorAtTime(dateAtHour(12, 55)).checkAndClaim({ everyNHours: 3 })).claimed).toBe(false);
      });

      it('should not advance lat when the gate is closed', async () => {
        const claimedAt = dateAtHour(12, 5);
        await accessorAtTime(claimedAt).checkAndClaim({ everyNHours: 3 });
        await accessorAtTime(dateAtHour(12, 55)).checkAndClaim({ everyNHours: 3 });

        expect((await readLastRunAt())?.getTime()).toBe(claimedAt.getTime());
      });

      it('should open the gate again in the next matching hour', async () => {
        expect((await accessorAtTime(dateAtHour(12)).checkAndClaim({ everyNHours: 3 })).claimed).toBe(true);
        expect((await accessorAtTime(dateAtHour(13)).checkAndClaim({ everyNHours: 3 })).claimed).toBe(false); // 13 % 3 !== 0
        expect((await accessorAtTime(dateAtHour(15)).checkAndClaim({ everyNHours: 3 })).claimed).toBe(true);
      });

      it('should close the gate when the hour is not an Nth hour', async () => {
        // 12 % 5 === 2, so an every-5-hours schedule does not run at noon even on a fresh document.
        const result = await accessorAtTime(dateAtHour(12)).checkAndClaim({ everyNHours: 5 });

        expect(result.claimed).toBe(false);
        expect(result.claimedAt).toBeNull();
        expect(await readLastRunAt()).toBeUndefined(); // and it must not have created the document
      });

      it('should let whichever caller passes first claim the hour for both', async () => {
        // One gate is one `lat`. N=1 matches every hour and N=3 matches noon, so both callers'
        // intervals are satisfied - but only the first one through runs.
        const accessor = accessorAtTime(dateAtHour(12));
        expect((await accessor.checkAndClaim({ everyNHours: 1 })).claimed).toBe(true);
        expect((await accessor.checkAndClaim({ everyNHours: 3 })).claimed).toBe(false);
      });

      it('should carry the read it decided from, for sub-gating tasks inside the claimed hour', async () => {
        // The motivating case: claim the hour ONCE with N=1, then let each task ask whether this is
        // also its hour - off the same `now`, with no second read and no second clock.
        const result = await accessorAtTime(dateAtHour(12, 15)).checkAndClaim({ everyNHours: 1 });

        expect(result.claimed).toBe(true);
        expect(result.everyNHours).toBe(1);
        expect(result.hourOfDay).toBe(12);
        expect(result.isNthHourOfDay(3)).toBe(true);
        expect(result.isNthHourOfDay(5)).toBe(false); // 12 % 5 === 2
        expect(result.nthHourOfDayIndex(3)).toBe(4); // 0, 3, 6, 9, 12
      });

      it('should report the pre-claim state rather than the claim it just wrote', async () => {
        const claimedAt = dateAtHour(12);
        const first = await accessorAtTime(claimedAt).checkAndClaim({ everyNHours: 3 });

        // A successful claim reports the state it decided FROM, so isOpen() still answers for the
        // other intervals in this hour instead of closing against this very call's own write.
        expect(first.lastRunAt).toBeNull();
        expect(first.hasRunInCurrentHour).toBe(false);
        expect(first.isOpen(6)).toBe(true);

        const second = await accessorAtTime(dateAtHour(12, 55)).checkAndClaim({ everyNHours: 3 });

        expect(second.claimed).toBe(false);
        expect(second.lastRunAt?.getTime()).toBe(claimedAt.getTime());
        expect(second.hasRunInCurrentHour).toBe(true);
        expect(second.isOpen(6)).toBe(false);
        // ...but the hour-of-day predicates ignore lastRunAt entirely, which is what makes them the
        // right sub-gate for a caller that already holds the hour.
        expect(second.isNthHourOfDay(6)).toBe(true);
      });

      it('should open the gate on the real clock for an every-hour schedule', async () => {
        // N=1 is an Nth hour of every hour, so this is deterministic without a clock override -
        // which is what proves the default nowFactory is wired.
        expect((await accessorAtTime().checkAndClaim({ everyNHours: 1 })).claimed).toBe(true);
        expect((await accessorAtTime().checkAndClaim({ everyNHours: 1 })).claimed).toBe(false);
      });
    });

    describe('read()', () => {
      it('should report a null lastRunAt for a fresh document', async () => {
        const read = await accessorAtTime(dateAtHour(12)).read();
        expect(read.lastRunAt).toBeNull();
      });

      it('should answer several intervals off one read', async () => {
        const read = await accessorAtTime(dateAtHour(12)).read();

        expect(read.isOpen(1)).toBe(true);
        expect(read.isOpen(3)).toBe(true);
        expect(read.isOpen(5)).toBe(false); // 12 % 5 === 2
        expect(read.isOpen(12)).toBe(true);
      });

      it('should not claim the hour', async () => {
        const accessor = accessorAtTime(dateAtHour(12));
        const read = await accessor.read();

        expect(read.isOpen(3)).toBe(true);
        expect(await readLastRunAt()).toBeUndefined();

        // still claimable afterwards
        expect((await accessor.checkAndClaim({ everyNHours: 3 })).claimed).toBe(true);
      });

      it('should report the claimed lastRunAt and a closed gate after a claim', async () => {
        const now = dateAtHour(12, 5);
        await accessorAtTime(now).checkAndClaim({ everyNHours: 3 });

        const read = await accessorAtTime(dateAtHour(12, 55)).read();
        expect(read.lastRunAt?.getTime()).toBe(now.getTime());
        expect(read.isOpen(3)).toBe(false);
      });
    });
  });
});
