import { buildManifestCommands, runCli } from '@dereekb/dbx-cli';
import { DEMO_CLI_ACTION_COMMANDS } from './lib/actions';
import { DEMO_DOCTOR_CHECKS } from './lib/doctor.checks';
import { DEFAULT_DEMO_CLI_ENVS } from './lib/env.defaults';
import { DEMO_CLI_API_MANIFEST, DEMO_CLI_MODEL_MANIFEST } from './lib/manifest/api.manifest.generated';

void runCli({
  cliName: 'demo-cli',
  doctorChecks: DEMO_DOCTOR_CHECKS,
  defaultEnvs: DEFAULT_DEMO_CLI_ENVS,
  modelManifest: DEMO_CLI_MODEL_MANIFEST,
  apiCommands: buildManifestCommands(DEMO_CLI_API_MANIFEST, { modelManifest: DEMO_CLI_MODEL_MANIFEST }),
  actionCommands: DEMO_CLI_ACTION_COMMANDS
});
