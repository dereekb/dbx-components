import { loadEnv } from 'vite';
import { createVitestConfig } from '../../vitest.preset.config.mjs';

const env = loadEnv('test', process.cwd());
const imported = import.meta.env;

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
  junitFilePrefix: `${timezoneKey}.` // e.g. "america-chicago.date.junit.xml"
});
