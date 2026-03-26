/**
 * Vitest setup for Angular projects.
 *
 * Importing this file runs the full Angular test setup: firebase setup,
 * Angular compiler + zone.js, a11y matchers, TestBed initialization,
 * and JSDOM polyfills.
 *
 * Due to a limitation in the Angular vitest plugin, this must be imported
 * from a project-local setup file (e.g., `src/test-setup.ts`) referenced
 * via `projectSpecificSetupFiles`, not loaded directly as a `setupFile`.
 *
 * @example
 * ```typescript
 * // src/test-setup.ts
 * import '@dereekb/vitest/setup-angular';
 * ```
 */
import { vi } from 'vitest';
import './setup-firebase.js';

import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import '@dereekb/vitest/a11y';

import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/**
 * Must add TextEncoder/TextDecoder to the globals since it is not available in JSDOM by default.
 *
 * https://github.com/firebase/firebase-js-sdk/issues/7845
 */
import { TextEncoder, TextDecoder } from 'util';
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Same with these: https://github.com/jsdom/jsdom/issues/1724
(global as any).fetch = fetch;
(global as any).Headers = Headers;
(global as any).Request = Request;
(global as any).Response = Response;

/**
 * Fix for lack of TransformStream in JSDOM
 */
import { TransformStream } from 'node:stream/web';
// Occured once @zip.js/zip.js was added to dependencies
(global as any).TransformStream = TransformStream;

/**
 * Fix for lack of ResizeObserver in JSDOM by default
 *
 * https://github.com/jsdom/jsdom/issues/3368
 */
import ResizeObserver from 'resize-observer-polyfill';
(global as any).ResizeObserver = ResizeObserver;

// https://stackoverflow.com/questions/39830580/jest-test-fails-typeerror-window-matchmedia-is-not-a-function
var window;

if (!window) {
  window = global;
}

if (window) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}
