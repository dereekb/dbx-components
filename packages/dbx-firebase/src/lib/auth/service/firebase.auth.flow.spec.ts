import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStandaloneWebApp, resolveDbxFirebaseAuthFlow } from './firebase.auth.flow';

type StandaloneNavigator = Navigator & { standalone?: boolean };

// The angular vitest setup polyfills window.matchMedia as a writable (matches:false) mock; capture it to restore between tests.
const defaultMatchMedia = window.matchMedia;

function setDisplayModeStandalone(matches: boolean): void {
  window.matchMedia = vi.fn((query: string) => ({ matches: query === '(display-mode: standalone)' ? matches : false })) as unknown as typeof window.matchMedia;
}

function removeMatchMedia(): void {
  window.matchMedia = undefined as unknown as typeof window.matchMedia;
}

function setIosStandalone(value: boolean): void {
  Object.defineProperty(window.navigator, 'standalone', { configurable: true, value });
}

afterEach(() => {
  window.matchMedia = defaultMatchMedia;
  delete (window.navigator as StandaloneNavigator).standalone;
});

describe('isStandaloneWebApp()', () => {
  it('should return true when the display-mode is standalone', () => {
    setDisplayModeStandalone(true);
    expect(isStandaloneWebApp()).toBe(true);
  });

  it('should return true when the iOS navigator.standalone flag is set', () => {
    setIosStandalone(true);
    expect(isStandaloneWebApp()).toBe(true);
  });

  it('should return false when neither signal is present', () => {
    setDisplayModeStandalone(false);
    expect(isStandaloneWebApp()).toBe(false);
  });

  it('should return false when matchMedia is unavailable and navigator.standalone is unset', () => {
    removeMatchMedia();
    expect(isStandaloneWebApp()).toBe(false);
  });
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
