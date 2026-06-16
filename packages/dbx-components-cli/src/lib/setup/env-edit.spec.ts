/**
 * Specs for the idempotent `.env` editor.
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureEnvVar } from './env-edit.js';

describe('ensureEnvVar', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbxc-env-'));
  });

  it('appends a key when absent', () => {
    const path = join(dir, '.env');
    writeFileSync(path, 'FOO=1\n');
    expect(ensureEnvVar(path, { key: 'OIDC_JWKS_ENCRYPTION_SECRET', value: 'placeholder' }).status).toBe('added');
    expect(readFileSync(path, 'utf8')).toBe('FOO=1\nOIDC_JWKS_ENCRYPTION_SECRET=placeholder\n');
  });

  it('is a no-op when the key already exists', () => {
    const path = join(dir, '.env');
    writeFileSync(path, 'OIDC_JWKS_ENCRYPTION_SECRET=existing\n');
    const before = readFileSync(path, 'utf8');
    expect(ensureEnvVar(path, { key: 'OIDC_JWKS_ENCRYPTION_SECRET', value: 'placeholder' }).status).toBe('present');
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('adds a trailing newline before appending when needed', () => {
    const path = join(dir, '.env');
    writeFileSync(path, 'FOO=1');
    ensureEnvVar(path, { key: 'BAR', value: '2' });
    expect(readFileSync(path, 'utf8')).toBe('FOO=1\nBAR=2\n');
  });

  it('reports file-missing without createIfMissing', () => {
    expect(ensureEnvVar(join(dir, '.env'), { key: 'X', value: 'y' }).status).toBe('file-missing');
  });

  it('creates the file when createIfMissing is set', () => {
    const path = join(dir, '.env');
    expect(ensureEnvVar(path, { key: 'X', value: 'y' }, { createIfMissing: true }).status).toBe('created');
    expect(readFileSync(path, 'utf8')).toBe('X=y\n');
  });
});
