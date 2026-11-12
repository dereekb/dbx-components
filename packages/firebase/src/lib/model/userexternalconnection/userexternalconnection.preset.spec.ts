import { describe, expect, it } from 'vitest';
import { MICROSOFT_GRAPH_READ_WRITE_SCOPES, MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS, type UserExternalConnectionScopePreset, userExternalConnectionScopePresetForCapabilities } from './userexternalconnection.preset';

const READ_PRESET: UserExternalConnectionScopePreset = { key: 'read', label: 'Read', scopes: ['Mail.Read', 'Calendars.Read'] };
const READ_WRITE_PRESET: UserExternalConnectionScopePreset = { key: 'readwrite', label: 'Read + Write', scopes: ['Mail.Read', 'Calendars.Read', 'Mail.ReadWrite'] };
const PRESETS = [READ_PRESET, READ_WRITE_PRESET];

describe('userExternalConnectionScopePresetForCapabilities()', () => {
  it('returns the largest fully covered preset', () => {
    expect(userExternalConnectionScopePresetForCapabilities({ presets: PRESETS, capabilities: ['Mail.Read', 'Calendars.Read', 'Mail.ReadWrite', 'User.Read'] })).toBe(READ_WRITE_PRESET);
  });

  it('returns the smaller preset when the larger is only partially covered', () => {
    expect(userExternalConnectionScopePresetForCapabilities({ presets: PRESETS, capabilities: ['Mail.Read', 'Calendars.Read'] })).toBe(READ_PRESET);
  });

  it('returns undefined when no preset is fully covered', () => {
    expect(userExternalConnectionScopePresetForCapabilities({ presets: PRESETS, capabilities: ['Mail.Read'] })).toBeUndefined();
  });

  it('returns undefined with no presets or capabilities', () => {
    expect(userExternalConnectionScopePresetForCapabilities({ presets: undefined, capabilities: ['Mail.Read'] })).toBeUndefined();
    expect(userExternalConnectionScopePresetForCapabilities({ presets: PRESETS, capabilities: undefined })).toBeUndefined();
  });
});

describe('MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS', () => {
  it('orders read before read + write, with read + write covering read', () => {
    const [read, readWrite] = MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS;

    expect(read.key).toBe('read');
    expect(readWrite.key).toBe('readwrite');
    expect(read.scopes.every((scope) => readWrite.scopes.includes(scope))).toBe(true);
  });

  it('sends mail only from read + write, and keeps read free of write and send scopes', () => {
    const [read] = MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS;

    expect(MICROSOFT_GRAPH_READ_WRITE_SCOPES).toContain('Mail.Send');
    expect(read.scopes.filter((scope) => /ReadWrite|Send/.test(scope))).toEqual([]);
  });

  it('requests no scope that needs admin consent', () => {
    // admin consent is tenant-wide; ChannelMessage.Read.All is the Teams read scope that needs it
    expect(MICROSOFT_GRAPH_READ_WRITE_SCOPES).not.toContain('ChannelMessage.Read.All');
  });
});
