import { buildManifestCommands, runCli } from '@dereekb/dbx-cli';
import { DEMO_CLI_ACTION_COMMANDS } from './lib/actions';
import { demoDoctorChecks } from './lib/doctor.checks';
import { DEMO_CLI_DEFAULT_ENVS } from './lib/env.defaults';
import { DEMO_CLI_API_MANIFEST, DEMO_CLI_MODEL_MANIFEST } from './lib/manifest/api.manifest.generated';

void runCli({
  cliName: 'demo-cli',
  doctorChecks: demoDoctorChecks,
  defaultEnvs: DEMO_CLI_DEFAULT_ENVS,
  modelManifest: DEMO_CLI_MODEL_MANIFEST,
  apiCommands: buildManifestCommands(DEMO_CLI_API_MANIFEST, { modelManifest: DEMO_CLI_MODEL_MANIFEST }),
  actionCommands: DEMO_CLI_ACTION_COMMANDS
});
