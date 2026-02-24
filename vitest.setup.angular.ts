import 'reflect-metadata';
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';

import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/**
 * https://github.com/jsdom/jsdom/issues/3363
 *
 * Fix for lack of structure clone
 */
import structuredClone from '@ungap/structured-clone';
(global as any).structuredClone = structuredClone;

/**
 * Must add TextEncoder/TextDecoder to the globals since it is not available in JSDOM by default.
 *
 * https://github.com/firebase/firebase-js-sdk/issues/7845
 */
import { TextEncoder, TextDecoder } from 'util';
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

/*
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
*/
