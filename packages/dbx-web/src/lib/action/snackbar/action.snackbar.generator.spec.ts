import { describe, it, expect, vi, afterEach } from 'vitest';
import { DbxActionContextMachine, type DbxActionContextSourceReference } from '@dereekb/dbx-core';
import { LoadingStateType } from '@dereekb/rxjs';
import { type Destroyable } from '@dereekb/util';
import { firstValueFrom, of, filter } from 'rxjs';
import { makeDbxActionSnackbarDisplayConfigGeneratorFunction } from './action.snackbar.generator';
import { dbxActionSnackbarUndoWork } from './action.snackbar.undo';

describe('makeDbxActionSnackbarDisplayConfigGeneratorFunction()', () => {
  const generator = makeDbxActionSnackbarDisplayConfigGeneratorFunction({
    success: { message: 'Deleted', button: 'Ok' }
  });

  const destroyables: Destroyable[] = [];

  function reference(): DbxActionContextSourceReference {
    const machine = new DbxActionContextMachine({ oneTimeUse: true, handleValueReady: false });
    destroyables.push(machine);
    return machine;
  }

  afterEach(() => {
    destroyables.splice(0).forEach((x) => x.destroy());
  });

  it('should set the undo config duration on the action', () => {
    const result = generator({ event: { type: LoadingStateType.SUCCESS }, undo: { duration: 1234, getUndoAction: reference } });
    expect(result?.action?.duration).toBe(1234);
    expect(result?.action?.button).toBe('Undo');
  });

  it('should build the action from a getter with no duration', () => {
    const ref = reference();
    const result = generator({ event: { type: LoadingStateType.SUCCESS }, undo: () => ref });
    expect(result?.action?.reference).toBe(ref);
    expect(result?.action?.duration).toBeUndefined();
  });

  it('should return undefined for an event type with no config', () => {
    const result = generator({ event: { type: LoadingStateType.ERROR }, undo: { getUndoAction: reference } });
    expect(result).toBeUndefined();
  });
});

describe('dbxActionSnackbarUndoWork()', () => {
  const destroyables: Destroyable[] = [];

  afterEach(() => {
    destroyables.splice(0).forEach((x) => x.destroy());
  });

  it('should pass the duration through', () => {
    const result = dbxActionSnackbarUndoWork({ work: () => of(undefined), duration: 500 });
    expect(result.duration).toBe(500);
  });

  it('should build a new action each time getUndoAction is called', () => {
    const result = dbxActionSnackbarUndoWork({ work: () => of(undefined) });
    const a = result.getUndoAction();
    const b = result.getUndoAction();
    destroyables.push(a, b);

    expect(a).toBeInstanceOf(DbxActionContextMachine);
    expect(a).not.toBe(b);
  });

  it('should read the value when getUndoAction is called and pass it to the work', async () => {
    let itemId = 'item-1';
    const work = vi.fn((id: string) => of(id));
    const result = dbxActionSnackbarUndoWork<string, string>({ work, value: () => itemId });

    const undoAction = result.getUndoAction();
    destroyables.push(undoAction);

    itemId = 'item-2'; // changed after the original action succeeded

    const success = firstValueFrom(undoAction.sourceInstance.success$.pipe(filter((x) => x != null)));
    undoAction.sourceInstance.triggerWithValue(''); // the snackbar's undo button readies an empty string

    expect(await success).toBe('item-1');
    expect(work).toHaveBeenCalledTimes(1);
    expect(work.mock.calls[0][0]).toBe('item-1');
  });
});
