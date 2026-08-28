import { type Maybe } from '@dereekb/util';
import { cliBuildDriftDescription, inspectCliBuildDrift, type InspectCliBuildDriftInput } from '../runner/build-stamp';
import { type DoctorCheck } from './doctor.command.factory';

/**
 * Name reported by the check {@link createCliBuildDriftDoctorCheck} builds.
 */
export const BUILD_DRIFT_DOCTOR_CHECK_NAME = 'cli-build-not-stale';

/**
 * Builds the doctor check that compares the running artifact against the `@dereekb/*` tree resolved
 * at run time.
 *
 * Runs FIRST in the default check list, ahead of every network hop, because a stale artifact
 * invalidates the answers those hops give: they exercise the framework that is loaded now, not the
 * one the bundle was compiled against, so a green `token-refresh-round-trip` next to a red read is
 * exactly the misleading report this check exists to pre-empt.
 *
 * @param input - Optional overrides forwarded to {@link inspectCliBuildDrift}; apps normally pass only
 *   `manifestGeneratorVersion`.
 * @returns The {@link DoctorCheck}.
 * @__NO_SIDE_EFFECTS__
 */
export function createCliBuildDriftDoctorCheck(input: InspectCliBuildDriftInput = {}): DoctorCheck {
  return async () => {
    const report = inspectCliBuildDrift(input);
    const description: Maybe<string> = cliBuildDriftDescription(report);

    return {
      name: BUILD_DRIFT_DOCTOR_CHECK_NAME,
      ok: report.ok,
      detail: report,
      ...(description == null ? {} : { suggestion: description })
    };
  };
}
