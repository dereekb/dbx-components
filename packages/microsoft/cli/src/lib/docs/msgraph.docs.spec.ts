import { validatePackageRefs } from '@dereekb/dbx-cli';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MSGRAPH_CLI_PACKAGE_REFS } from './msgraph.docs';

describe('msgraph-cli package refs', () => {
  it('should ship every declared ref and embed exactly the files on disk', () => {
    expect(validatePackageRefs({ packageRoot: resolve(import.meta.dirname, '../../../..'), embedded: MSGRAPH_CLI_PACKAGE_REFS })).toEqual([]);
  });
});
