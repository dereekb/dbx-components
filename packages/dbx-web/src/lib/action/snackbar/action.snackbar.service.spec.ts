import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { type MatSnackBarConfig, type MatSnackBarRef } from '@angular/material/snack-bar';
import { type DbxActionContextSourceReference } from '@dereekb/dbx-core';
import { Subject } from 'rxjs';
import { DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION, type DbxActionSnackbarDisplayConfig } from './action.snackbar';
import { DBX_ACTION_SNACKBAR_SERVICE_CONFIG, DEFAULT_SNACKBAR_DIRECTIVE_DURATION, DbxActionSnackbarService, type DbxActionSnackbarServiceConfig } from './action.snackbar.service';

describe('DbxActionSnackbarService', () => {
  let service: DbxActionSnackbarService;
  let openFromComponentSpy: MockInstance;
  let afterDismissed: Subject<void>;

  function setup(config?: Partial<DbxActionSnackbarServiceConfig>) {
    TestBed.configureTestingModule({
      providers: config ? [{ provide: DBX_ACTION_SNACKBAR_SERVICE_CONFIG, useValue: config }] : []
    });

    service = TestBed.inject(DbxActionSnackbarService);
    afterDismissed = new Subject<void>();
    openFromComponentSpy = vi.spyOn(service.matSnackBar, 'openFromComponent').mockImplementation(() => ({ afterDismissed: () => afterDismissed.asObservable() }) as unknown as MatSnackBarRef<unknown>);
  }

  function lastMatSnackbarConfig(): MatSnackBarConfig<DbxActionSnackbarDisplayConfig> {
    const calls = openFromComponentSpy.mock.calls;
    return calls[calls.length - 1][1] as MatSnackBarConfig<DbxActionSnackbarDisplayConfig>;
  }

  function fakeReference(): DbxActionContextSourceReference {
    return { sourceInstance: {}, destroy: vi.fn() } as unknown as DbxActionContextSourceReference;
  }

  afterEach(() => {
    openFromComponentSpy?.mockRestore();
    TestBed.resetTestingModule();
  });

  describe('plain snackbar', () => {
    beforeEach(() => setup());

    it('should use the default duration', () => {
      service.openSnackbar({ message: 'Saved' });
      expect(lastMatSnackbarConfig().duration).toBe(DEFAULT_SNACKBAR_DIRECTIVE_DURATION);
    });

    it('should use the snackbar duration', () => {
      service.openSnackbar({ message: 'Saved', snackbar: { duration: 1500 } });
      expect(lastMatSnackbarConfig().duration).toBe(1500);
    });
  });

  describe('action snackbar', () => {
    beforeEach(() => setup());

    it('should not pass a duration to MatSnackBar', () => {
      service.openSnackbar({ message: 'Deleted', snackbar: { duration: 1500 }, action: { button: 'Undo', reference: fakeReference() } });
      expect(lastMatSnackbarConfig().duration).toBeUndefined();
    });

    it('should prefer the action duration', () => {
      service.openSnackbar({ message: 'Deleted', snackbar: { duration: 1500 }, action: { button: 'Undo', reference: fakeReference(), duration: 700 } });
      expect(lastMatSnackbarConfig().data?.action?.duration).toBe(700);
    });

    it('should fall back to the snackbar duration', () => {
      service.openSnackbar({ message: 'Deleted', snackbar: { duration: 1500 }, action: { button: 'Undo', reference: fakeReference() } });
      expect(lastMatSnackbarConfig().data?.action?.duration).toBe(1500);
    });

    it('should fall back to the default undo duration', () => {
      service.openSnackbar({ message: 'Deleted', action: { button: 'Undo', reference: fakeReference() } });
      expect(lastMatSnackbarConfig().data?.action?.duration).toBe(DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION);
    });

    it('should destroy the action reference once when dismissed', () => {
      const reference = fakeReference();
      service.openSnackbar({ message: 'Deleted', action: { button: 'Undo', reference } });

      expect(reference.destroy).not.toHaveBeenCalled();
      afterDismissed.next();
      afterDismissed.complete();
      expect(reference.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('with a configured defaultUndoDuration', () => {
    beforeEach(() => setup({ defaultUndoDuration: 2500 }));

    it('should use the configured default undo duration', () => {
      service.openSnackbar({ message: 'Deleted', action: { button: 'Undo', reference: fakeReference() } });
      expect(lastMatSnackbarConfig().data?.action?.duration).toBe(2500);
    });
  });
});
