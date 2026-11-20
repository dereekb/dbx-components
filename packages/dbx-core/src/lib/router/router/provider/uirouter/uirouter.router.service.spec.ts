import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StateService, TransitionService, UIRouter, UIRouterGlobals } from '@uirouter/core';
import { DbxUIRouterService } from './uirouter.router.service';

describe('DbxUIRouterService', () => {
  let service: DbxUIRouterService;
  let stateGo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stateGo = vi.fn().mockResolvedValue({});

    TestBed.configureTestingModule({
      providers: [DbxUIRouterService, { provide: UIRouter, useValue: {} }, { provide: StateService, useValue: { go: stateGo } }, { provide: TransitionService, useValue: { onStart: vi.fn(), onSuccess: vi.fn() } }, { provide: UIRouterGlobals, useValue: { params: { id: '1' }, current: { params: {} } } }]
    });

    service = TestBed.inject(DbxUIRouterService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('go()', () => {
    it('should pass the refOptions through unchanged when no options are given', async () => {
      await service.go({ ref: 'app.home', refOptions: { reload: true } });
      expect(stateGo).toHaveBeenCalledWith('app.home', {}, { reload: true });
    });

    it('should replace the current history entry when replace is true', async () => {
      await service.go('app.home', { replace: true });
      expect(stateGo).toHaveBeenCalledWith('app.home', {}, { location: 'replace' });
    });

    it('should keep the other refOptions when replacing', async () => {
      await service.go({ ref: 'app.home', refOptions: { reload: true, inherit: false } }, { replace: true });
      expect(stateGo).toHaveBeenCalledWith('app.home', {}, { reload: true, inherit: false, location: 'replace' });
    });

    it('should override a conflicting location in the refOptions when replacing', async () => {
      await service.go({ ref: 'app.home', refOptions: { location: true } }, { replace: true });
      expect(stateGo).toHaveBeenCalledWith('app.home', {}, { location: 'replace' });
    });

    it('should leave the refOptions alone when replace is false', async () => {
      await service.go({ ref: 'app.home', refOptions: { location: 'replace' } }, { replace: false });
      expect(stateGo).toHaveBeenCalledWith('app.home', {}, { location: 'replace' });
    });

    it('should not mutate the segue ref refOptions', async () => {
      const refOptions = { reload: true };
      await service.go({ ref: 'app.home', refOptions }, { replace: true });
      expect(refOptions).toEqual({ reload: true });
    });

    it('should resolve false when the transition is rejected', async () => {
      stateGo.mockRejectedValueOnce(new Error('rejected'));
      const result = await service.go('app.home');
      expect(result).toBe(false);
    });
  });

  describe('updateParams()', () => {
    it('should replace the current history entry and inherit the params', async () => {
      await service.updateParams({ page: 2 });
      expect(stateGo).toHaveBeenCalledWith('.', { id: '1', page: 2 }, { inherit: true, location: 'replace' });
    });
  });
});
