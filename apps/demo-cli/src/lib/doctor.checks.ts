import type { DoctorCheck } from '@dereekb/dbx-cli';

/**
 * Demo-specific doctor checks that augment the dbx-cli built-in suite.
 *
 * Currently a placeholder list — populate as demo-specific reachability/wiring checks become useful
 * (e.g. emulator port reachability when env name is `local`, demo schema version compatibility, etc.).
 */
export const demoDoctorChecks: DoctorCheck[] = [];
