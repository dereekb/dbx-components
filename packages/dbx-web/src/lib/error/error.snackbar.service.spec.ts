import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { readableError } from '@dereekb/util';
import { DbxErrorSnackbarComponent, type DbxErrorSnackbarConfig } from './error.snackbar.component';
import { DEFAULT_DBX_ERROR_SNACKBAR_CONFIG, DbxErrorSnackbarService } from './error.snackbar.service';

describe('DbxErrorSnackbarService', () => {
  let service: DbxErrorSnackbarService;
  let showErrorSnackbarSpy: MockInstance<typeof DbxErrorSnackbarComponent.showErrorSnackbar>;

  const error = readableError('TEST', 'Test error');

  function lastConfig(): DbxErrorSnackbarConfig | undefined {
    const calls = showErrorSnackbarSpy.mock.calls;
    return calls[calls.length - 1][2];
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DbxErrorSnackbarService);
    showErrorSnackbarSpy = vi.spyOn(DbxErrorSnackbarComponent, 'showErrorSnackbar').mockImplementation(() => undefined as unknown as ReturnType<typeof DbxErrorSnackbarComponent.showErrorSnackbar>);
  });

  afterEach(() => {
    showErrorSnackbarSpy.mockRestore();
  });

  it('should let the per-call config override the default config', () => {
    service.showSnackbarError(error, { verticalPosition: 'top' });
    expect(lastConfig()?.verticalPosition).toBe('top');
  });

  it('should keep the default positions when only a duration is passed', () => {
    service.showSnackbarError(error, { duration: 5000 });
    const config = lastConfig();

    expect(config?.duration).toBe(5000);
    expect(config?.verticalPosition).toBe(DEFAULT_DBX_ERROR_SNACKBAR_CONFIG.verticalPosition);
    expect(config?.horizontalPosition).toBe(DEFAULT_DBX_ERROR_SNACKBAR_CONFIG.horizontalPosition);
  });

  it('should keep the default when the per-call value is undefined', () => {
    service.showSnackbarError(error, { verticalPosition: undefined });
    expect(lastConfig()?.verticalPosition).toBe(DEFAULT_DBX_ERROR_SNACKBAR_CONFIG.verticalPosition);
  });

  it('should replace the defaults with setDefaultConfig()', () => {
    service.setDefaultConfig({ verticalPosition: 'top', duration: 8000 });
    service.showSnackbarError(error);
    const config = lastConfig();

    expect(config?.verticalPosition).toBe('top');
    expect(config?.duration).toBe(8000);
    expect(config?.horizontalPosition).toBeUndefined();
  });
});
