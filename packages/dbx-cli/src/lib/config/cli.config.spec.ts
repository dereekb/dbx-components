import { describe, it, expect } from 'vitest';
import { maskSecret, resolveOutputConfig } from './cli.config';

describe('maskSecret', () => {
  it('returns *** when 4 chars or fewer', () => {
    expect(maskSecret('1234')).toBe('***');
    expect(maskSecret('a')).toBe('***');
  });

  it('keeps the first 4 chars then ***', () => {
    expect(maskSecret('1000.refresh_token_value')).toBe('1000***');
  });

  it('returns undefined when given undefined', () => {
    expect(maskSecret(undefined)).toBeUndefined();
  });
});

describe('resolveOutputConfig', () => {
  it('uses CLI flags when provided', () => {
    const result = resolveOutputConfig({
      outputConfig: { dumpDir: 'global', pick: 'g' },
      commandPath: ['call'],
      cliFlags: { dumpDir: 'flag', pick: 'f' }
    });
    expect(result).toEqual({ dumpDir: 'flag', pick: 'f' });
  });

  it('falls back to per-command config when CLI flags are missing', () => {
    const result = resolveOutputConfig({
      outputConfig: { dumpDir: 'global', pick: 'g', commands: { 'call.profile': { dumpDir: 'cmd', pick: 'c' } } },
      commandPath: ['call', 'profile'],
      cliFlags: {}
    });
    expect(result).toEqual({ dumpDir: 'cmd', pick: 'c' });
  });

  it('falls back to global config when neither flags nor per-command are set', () => {
    const result = resolveOutputConfig({
      outputConfig: { dumpDir: 'global', pick: 'g' },
      commandPath: ['env', 'list'],
      cliFlags: {}
    });
    expect(result).toEqual({ dumpDir: 'global', pick: 'g' });
  });

  it('returns undefined fields when no config at all', () => {
    const result = resolveOutputConfig({ outputConfig: undefined, commandPath: [], cliFlags: {} });
    expect(result).toEqual({ dumpDir: undefined, pick: undefined });
  });
});
