import { runCli } from '@dereekb/dbx-cli';
import { demoDoctorChecks } from './lib/doctor.checks';
import { DEMO_CLI_DEFAULT_ENVS } from './lib/env.defaults';

void runCli({
  cliName: 'demo-cli',
  doctorChecks: demoDoctorChecks,
  defaultEnvs: DEMO_CLI_DEFAULT_ENVS
});
