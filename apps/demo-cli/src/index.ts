import { buildManifestCommands, runCli } from '@dereekb/dbx-cli';
import { demoDoctorChecks } from './lib/doctor.checks';
import { DEMO_CLI_DEFAULT_ENVS } from './lib/env.defaults';
import { DEMO_CLI_API_MANIFEST } from './lib/manifest/api.manifest.generated';

void runCli({
  cliName: 'demo-cli',
  doctorChecks: demoDoctorChecks,
  defaultEnvs: DEMO_CLI_DEFAULT_ENVS,
  apiCommands: buildManifestCommands(DEMO_CLI_API_MANIFEST)
});
