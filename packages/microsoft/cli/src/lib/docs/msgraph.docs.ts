import { type EmbeddedPackageRefs } from '@dereekb/dbx-cli';
import msgraphCliRef from '../../../../refs/msgraph-cli/REF.md?raw';

/**
 * The agent docs (dbx-claude refs) `@dereekb/microsoft` ships under `refs/`, embedded in the msgraph-cli bundle for
 * `msgraph-cli docs`. Every file under `packages/microsoft/refs/` is imported here; `msgraph.docs.spec.ts` fails when one
 * is missing.
 */
export const MSGRAPH_CLI_PACKAGE_REFS: EmbeddedPackageRefs = {
  packageName: '@dereekb/microsoft',
  refs: [{ name: 'msgraph-cli', content: msgraphCliRef }]
};
