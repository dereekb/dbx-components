import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStandaloneWebApp } from './standalone';

interface StubWindowConfig {
  readonly displayModeStandalone?: boolean;
  readonly iosStandalone?: boolean;
  readonly noMatchMedia?: boolean;
}

// The browser package tests run in node, so a minimal window is stubbed per test.
function stubWindow(config: StubWindowConfig): void {
  const { displayModeStandalone = false, iosStandalone, noMatchMedia } = config;
  const matchMedia = noMatchMedia ? undefined : vi.fn((query: string) => ({ matches: query === '(display-mode: standalone)' ? displayModeStandalone : false }));
  vi.stubGlobal('window', { matchMedia, navigator: { standalone: iosStandalone } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isStandaloneWebApp()', () => {
  it('should return true when the display-mode is standalone', () => {
    stubWindow({ displayModeStandalone: true });
    expect(isStandaloneWebApp()).toBe(true);
  });

  it('should return true when the iOS navigator.standalone flag is set', () => {
    stubWindow({ iosStandalone: true });
    expect(isStandaloneWebApp()).toBe(true);
  });

  it('should return false when neither signal is present', () => {
    stubWindow({ displayModeStandalone: false });
    expect(isStandaloneWebApp()).toBe(false);
  });

  it('should return false when matchMedia is unavailable and navigator.standalone is unset', () => {
    stubWindow({ noMatchMedia: true });
    expect(isStandaloneWebApp()).toBe(false);
  });

  it('should return false when window is unavailable', () => {
    expect(typeof window).toBe('undefined');
    expect(isStandaloneWebApp()).toBe(false);
  });
});
