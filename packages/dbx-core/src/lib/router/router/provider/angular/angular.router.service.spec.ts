import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DbxAngularRouterService } from './angular.router.service';

describe('DbxAngularRouterService', () => {
  let service: DbxAngularRouterService;
  let navigateSpy: MockInstance;
  let navigateByUrlSpy: MockInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), DbxAngularRouterService]
    });

    service = TestBed.inject(DbxAngularRouterService);
    navigateSpy = vi.spyOn(service.router, 'navigate').mockResolvedValue(true);
    navigateByUrlSpy = vi.spyOn(service.router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    navigateSpy.mockRestore();
    navigateByUrlSpy.mockRestore();
    TestBed.resetTestingModule();
  });

  describe('go()', () => {
    it('should use replaceUrl for a url ref when replace is true', async () => {
      await service.go('/jobs', { replace: true });
      expect(navigateByUrlSpy).toHaveBeenCalledWith('/jobs', { replaceUrl: true });
    });

    it('should use replaceUrl and keep the queryParams for an array ref when replace is true', async () => {
      await service.go({ ref: ['jobs'], refParams: { page: 2 } }, { replace: true });
      expect(navigateSpy).toHaveBeenCalledWith(['jobs'], { replaceUrl: true, queryParams: { page: 2 } });
    });

    it('should pass the refOptions through unchanged when no options are given', async () => {
      await service.go({ ref: '/jobs', refOptions: { state: { from: 'test' } } });
      expect(navigateByUrlSpy).toHaveBeenCalledWith('/jobs', { state: { from: 'test' } });
    });

    it('should keep the other refOptions and override a conflicting replaceUrl when replacing', async () => {
      await service.go({ ref: '/jobs', refOptions: { replaceUrl: false, state: { from: 'test' } } }, { replace: true });
      expect(navigateByUrlSpy).toHaveBeenCalledWith('/jobs', { replaceUrl: true, state: { from: 'test' } });
    });

    it('should leave the refOptions alone when replace is false', async () => {
      await service.go({ ref: '/jobs', refOptions: { replaceUrl: true } }, { replace: false });
      expect(navigateByUrlSpy).toHaveBeenCalledWith('/jobs', { replaceUrl: true });
    });
  });

  describe('updateParams()', () => {
    it('should replace the current history entry', async () => {
      await service.updateParams({ page: 2 });
      expect(navigateSpy).toHaveBeenCalledWith(expect.any(Array), { replaceUrl: true, queryParams: { page: 2 } });
    });
  });
});
