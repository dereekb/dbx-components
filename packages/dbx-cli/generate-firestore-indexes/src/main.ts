/**
 * Thin CLI wrapper around {@link runGenerateFirestoreIndexesCli} for the
 * standalone `dbx-cli-generate-firestore-indexes` bin.
 *
 * Walks a downstream `-firebase` component for `@dbxModelFirebaseIndex`-
 * tagged factories and writes (or `--check`s) the generated
 * `firestore.indexes.json`. See `runGenerateFirestoreIndexesCli` for the
 * full argv contract.
 */

import packageJson from '../package.json' with { type: 'json' };
import { runGenerateFirestoreIndexesCli } from '@dereekb/dbx-cli/firestore-indexes';

const result = await runGenerateFirestoreIndexesCli({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  generator: `@dereekb/dbx-cli-generate-firestore-indexes@${packageJson.version}`
});

process.exit(result.exitCode);
