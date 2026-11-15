import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatePackageRefs } from './package-refs.validate';

describe('@dereekb/dbx-cli package refs', () => {
  it('should ship every declared ref', () => {
    expect(validatePackageRefs({ packageRoot: resolve(import.meta.dirname, '../../..') })).toEqual([]);
  });
});
