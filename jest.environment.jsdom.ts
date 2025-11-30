//
// This wasn't an issue for dbx-components v11, but is an issue now for the dbx-firebase module with fetch used in @firebase/rules-unit-testing but not available in jsdom by default.
//
// The solution is from here: https://github.com/jsdom/jsdom/issues/1724#issuecomment-1446858041
//
//

import JSDOMEnvironment from 'jest-environment-jsdom';

// https://github.com/facebook/jest/blob/v29.4.3/website/versioned_docs/version-29.4/Configuration.md#testenvironment-string
export default class FixJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...args);

    // FIXME https://github.com/jsdom/jsdom/issues/1724
    this.global.fetch = fetch;
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;

    // Fixes ReferenceError: TransformStream is not defined
    // Occured once @zip.js/zip.js was added to dependencies
    this.global.TransformStream = TransformStream;
  }
}
