import 'jest-preset-angular/setup-jest';

/**
 * Must be imported here so the Reflect functionality is availble in the Jest instance.
 *
 * Typically Angular already imports this functionality. NestJS also will import this functionality on its own.
 */
import 'reflect-metadata';

/**
 * Must add TextEncoder/TextDecoder to the globals since it is not available in JSDOM by default.
 *
 * https://github.com/firebase/firebase-js-sdk/issues/7845
 */
import { TextEncoder, TextDecoder } from 'util';
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// https://stackoverflow.com/questions/39830580/jest-test-fails-typeerror-window-matchmedia-is-not-a-function
var window: any;
beforeAll(() => {
  if (window) {
    // only use in jsdom environment
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // Deprecated
        removeListener: jest.fn(), // Deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    });
  }
});
