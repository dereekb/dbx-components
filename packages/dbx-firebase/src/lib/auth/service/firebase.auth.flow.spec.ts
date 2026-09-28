import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDbxFirebaseAuthFlow } from './firebase.auth.flow';

// The angular vitest setup polyfills window.matchMedia as a writable (matches:false) mock; capture it to restore between tests.
const defaultMatchMedia = window.matchMedia;

function setDisplayModeStandalone(matches: boolean): void {
  window.matchMedia = vi.fn((query: string) => ({ matches: query === '(display-mode: standalone)' ? matches : false })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = defaultMatchMedia;
});

describe('resolveDbxFirebaseAuthFlow()', () => {
  it('should return popup for popup', () => {
    expect(resolveDbxFirebaseAuthFlow('popup')).toBe('popup');
  });

  it('should return redirect for redirect', () => {
    expect(resolveDbxFirebaseAuthFlow('redirect')).toBe('redirect');
  });

  it('should resolve auto to redirect when running as a standalone web app', () => {
    setDisplayModeStandalone(true);
    expect(resolveDbxFirebaseAuthFlow('auto')).toBe('redirect');
  });

  it('should resolve auto to popup when not running as a standalone web app', () => {
    setDisplayModeStandalone(false);
    expect(resolveDbxFirebaseAuthFlow('auto')).toBe('popup');
  });
});
