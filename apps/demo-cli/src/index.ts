import { buildManifestCommands, runCli } from '@dereekb/dbx-cli';
import { DEMO_CLI_ACTION_COMMANDS } from './lib/actions';
import { DEMO_DOCTOR_CHECKS } from './lib/doctor.checks';
import { DEFAULT_DEMO_CLI_ENVS } from './lib/env.defaults';
import { demoCliFirestore } from './lib/firestore';
import { DEMO_CLI_API_MANIFEST, DEMO_CLI_MODEL_MANIFEST } from './lib/manifest/api.manifest.generated';
import { DEMO_CLI_FIRESTORE_QUERY_MANIFEST, DEMO_CLI_FIRESTORE_QUERY_MANIFEST_STAMP } from './lib/manifest/query.manifest.generated';

void runCli({
  cliName: 'demo-cli',
  doctorChecks: DEMO_DOCTOR_CHECKS,
  defaultEnvs: DEFAULT_DEMO_CLI_ENVS,
  modelManifest: DEMO_CLI_MODEL_MANIFEST,
  // one hook wires `firestore-get` / `firestore-query` for EVERY registered demo model — the same
  // collections object the Angular app builds, read through the same security rules
  firestore: demoCliFirestore.binding,
  firestoreQueryManifest: DEMO_CLI_FIRESTORE_QUERY_MANIFEST,
  // the generator version the committed manifests were emitted by, so `doctor`'s `cli-build-not-stale`
  // check can also catch manifests left behind by a `@dereekb/*` bump that skipped regeneration
  manifestGeneratorVersion: DEMO_CLI_FIRESTORE_QUERY_MANIFEST_STAMP.generatorVersion,
  apiCommands: buildManifestCommands(DEMO_CLI_API_MANIFEST, { modelManifest: DEMO_CLI_MODEL_MANIFEST }),
  actionCommands: DEMO_CLI_ACTION_COMMANDS
});
