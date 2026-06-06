import { describe, it, expect } from 'vitest';
import { computeModelSizeFromProfileFile } from './lib/model-size.entry';
import { formatModelSizeReport } from './lib/model-size.report';

/**
 * Design-time entrypoint for the snapshot-size calculator. Run via:
 *
 * ```sh
 * MODEL_SIZE_PROFILE=packages/dbx-cli/model-size/example.profile.json npx nx run dbx-cli-model-size:size
 * ```
 *
 * Set `MODEL_SIZE_JSON=1` to emit the structured report instead of the table.
 * When `MODEL_SIZE_PROFILE` is unset (e.g. a plain `nx test` run) the case is
 * skipped so the harness never fails the normal test suite.
 */
const profilePath = process.env['MODEL_SIZE_PROFILE'];

describe('model-size harness', () => {
  if (profilePath) {
    it(`sizes the converter named by ${profilePath}`, async () => {
      const report = await computeModelSizeFromProfileFile(profilePath);

      if (process.env['MODEL_SIZE_JSON'] === '1') {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        process.stdout.write(`\n${formatModelSizeReport(report)}\n\n`);
      }

      expect(report.bytes).toBeGreaterThan(0);
    });
  } else {
    it.skip('set MODEL_SIZE_PROFILE to a profile JSON path and run the `size` target', () => {
      // intentionally skipped — this is the design-tool entrypoint, not a unit test
    });
  }
});
