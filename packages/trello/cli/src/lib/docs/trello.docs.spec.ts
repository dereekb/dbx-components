import { validatePackageRefs } from '@dereekb/dbx-cli';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRELLO_CLI_PACKAGE_REFS } from './trello.docs';
import { loadTrelloCliPackageRefs } from './trello.docs.runtime';

describe('trello-cli package refs', () => {
  it('should ship every declared ref and embed exactly the files on disk', () => {
    expect(validatePackageRefs({ packageRoot: resolve(import.meta.dirname, '../../../..'), embedded: TRELLO_CLI_PACKAGE_REFS })).toEqual([]);
  });

  it('should read the same refs from disk at runtime as the binary embeds', () => {
    expect(loadTrelloCliPackageRefs()).toEqual(TRELLO_CLI_PACKAGE_REFS);
  });
});
