import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { goWithRouter } from './router.go';
import { type DbxRouterService } from './router.service';

describe('goWithRouter()', () => {
  it('should pass the options to go()', async () => {
    const go = vi.fn().mockResolvedValue(true);
    const dbxRouterService = { go } as unknown as DbxRouterService;

    const result = await goWithRouter(dbxRouterService)({ ref: 'app.home' }, { replace: true });

    expect(result).toBe(true);
    expect(go).toHaveBeenCalledWith({ ref: 'app.home' }, { replace: true });
  });

  it('should resolve an observable route before navigating', async () => {
    const go = vi.fn().mockResolvedValue(true);
    const dbxRouterService = { go } as unknown as DbxRouterService;

    await goWithRouter(dbxRouterService)(of({ ref: 'app.home' }));

    expect(go).toHaveBeenCalledWith({ ref: 'app.home' }, undefined);
  });
});
