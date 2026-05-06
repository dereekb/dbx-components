import { runCli } from '@dereekb/dbx-cli';
import { demoDoctorChecks } from './lib/doctor.checks';

void runCli({
  cliName: 'demo-cli',
  doctorChecks: demoDoctorChecks
});
