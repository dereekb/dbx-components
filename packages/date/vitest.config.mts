import { createVitestConfig } from '../../vitest.preset.config.mjs';

// Allow our tests to also include a custom timezone.
// Example command using this: "TZ=america/chicago nx test date"
const timezone = process.env.TZ ?? Intl.DateTimeFormat()?.resolvedOptions()?.timeZone ?? 'utc';
const timezoneKey = timezone.toLowerCase().replace('/', '-');

export default createVitestConfig({
  type: 'node',
  pathFromRoot: __dirname,
  projectName: 'date',
  configureEnv: () => ({
    TZ: timezone
  }),
  junitConfig: () => ({
    suiteName: timezone,
    outputFilePrefix: `${timezoneKey}.`
  }),
  test: {
    // can run all tests in parallel
    maxWorkers: 10,
    maxConcurrency: 10,
    // recurrence tests can take longer on circleci and timeout with the default while tests are running in parallel
    testTimeout: 10000
  }
});
