import { describe, it, expect, afterEach, vi } from 'vitest';
import { Subject, filter, first, firstValueFrom, of } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxActionContextMachine } from './action.machine';
import { DbxActionState } from './action';
import { ACTION_CONTEXT_STORE_LOCKSET_DESTROY_DELAY_TIME, type ActionContextStore } from './action.store';

/**
 * Time to advance past the store's queued teardown (unlock delay + the lock set's own destroy delay).
 */
const STORE_TEARDOWN_TIME = ACTION_CONTEXT_STORE_LOCKSET_DESTROY_DELAY_TIME + 500;

// These specs intentionally do not use TestBed, which proves the machine can be built outside of an injection context.
describe('DbxActionContextMachine', () => {
  let machine: Maybe<DbxActionContextMachine<number, number>>;

  afterEach(() => {
    machine?.destroy();
    machine = undefined;
    vi.useRealTimers();
  });

  function storeOf(x: DbxActionContextMachine<number, number>): Promise<ActionContextStore<number, number>> {
    return firstValueFrom(x.store$);
  }

  it('should construct outside of an injection context', () => {
    expect(() => (machine = new DbxActionContextMachine<number, number>({ oneTimeUse: false, handleValueReady: false }))).not.toThrow();
  });

  it('should run the work when triggered with a value and resolve', async () => {
    const work = vi.fn((value: number) => of(value * 2));
    machine = new DbxActionContextMachine<number, number>({ oneTimeUse: false, handleValueReady: work });

    const resolved = firstValueFrom(machine.sourceInstance.actionState$.pipe(filterState(DbxActionState.RESOLVED)));
    const success = firstValueFrom(machine.success$);

    machine.triggerWithValue(5);

    await resolved;
    expect(work).toHaveBeenCalledTimes(1);
    expect(work.mock.calls[0][0]).toBe(5);
    expect(await success).toBe(10);
  });

  it('should not be shutdown until destroyed', () => {
    machine = new DbxActionContextMachine<number, number>({ oneTimeUse: false, handleValueReady: false });
    expect(machine.isShutdown).toBe(false);

    machine.destroy();
    expect(machine.isShutdown).toBe(true);
  });

  it('should destroy itself shortly after its first success when oneTimeUse is true', async () => {
    vi.useFakeTimers();
    machine = new DbxActionContextMachine<number, number>({ oneTimeUse: true, handleValueReady: (value: number) => of(value) });

    machine.triggerWithValue(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(machine.isShutdown).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(machine.isShutdown).toBe(true);
  });

  it('should tear down the store without error when destroyed before any trigger', async () => {
    vi.useFakeTimers();
    machine = new DbxActionContextMachine<number, number>({ oneTimeUse: true, handleValueReady: (value: number) => of(value) });

    const store = await storeOf(machine);
    let completed = false;
    store.state$.subscribe({ complete: () => (completed = true) });

    machine.destroy();
    expect(completed).toBe(false);

    await vi.advanceTimersByTimeAsync(STORE_TEARDOWN_TIME);
    expect(completed).toBe(true);
    expect(store.lockSet.isDestroyed).toBe(true);
  });

  it('should be safe to destroy more than once', async () => {
    vi.useFakeTimers();
    machine = new DbxActionContextMachine<number, number>({ oneTimeUse: false, handleValueReady: false });
    const store = await storeOf(machine);
    const ngOnDestroySpy = vi.spyOn(store, 'ngOnDestroy');

    machine.destroy();
    expect(() => machine?.destroy()).not.toThrow();
    expect(ngOnDestroySpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(STORE_TEARDOWN_TIME);
    expect(store.lockSet.isDestroyed).toBe(true);
  });

  it('should keep the store alive while work is in flight, then tear it down', async () => {
    vi.useFakeTimers();
    const workSubject = new Subject<number>();
    machine = new DbxActionContextMachine<number, number>({ oneTimeUse: false, handleValueReady: () => workSubject.pipe(first()) });

    const store = await storeOf(machine);
    machine.triggerWithValue(1);
    await vi.advanceTimersByTimeAsync(10);

    machine.destroy();
    await vi.advanceTimersByTimeAsync(STORE_TEARDOWN_TIME * 2);
    expect(store.lockSet.isDestroyed).toBe(false);

    workSubject.next(2);
    workSubject.complete();

    await vi.advanceTimersByTimeAsync(STORE_TEARDOWN_TIME);
    expect(store.lockSet.isDestroyed).toBe(true);
  });
});

function filterState(state: DbxActionState) {
  return filter((x: DbxActionState) => x === state);
}
