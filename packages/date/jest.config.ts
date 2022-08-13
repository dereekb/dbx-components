/* eslint-disable */
// Allow our tests to also include a custom timezone.
// Example command using this: "TZ=america/chicago nx test date"
const timezone = process.env.TZ ?? Intl.DateTimeFormat()?.resolvedOptions()?.timeZone ?? 'utc';
const timezoneKey = timezone.toLowerCase().replace('/', '-');

process.env.JEST_JUNIT_OUTPUT_NAME = `${timezoneKey.toLowerCase()}.date.junit.xml`;

module.exports = {
  displayName: 'date',
  coverageDirectory: '../../coverage/packages/date',
  preset: '../../jest.preset.ts'
};
