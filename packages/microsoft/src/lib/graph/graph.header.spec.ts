import { describe, expect, it } from 'vitest';
import { MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER, canonicalizeMicrosoftGraphHeaders, microsoftGraphBodyContentTypePrefer, microsoftGraphPreferHeaderValue, microsoftGraphTimeZonePrefer } from './graph.header';
import { readMicrosoftGraphRequiredScopesFromErrorMessage } from './graph.error.api';

describe('microsoftGraphPreferHeaderValue()', () => {
  it('comma-joins the values and skips empty ones', () => {
    // models: outlook-immutable-id — Prefer values combine as a comma-separated list
    expect(microsoftGraphPreferHeaderValue([MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER, undefined, '', microsoftGraphBodyContentTypePrefer('text'), microsoftGraphTimeZonePrefer('UTC')])).toBe('IdType="ImmutableId", outlook.body-content-type="text", outlook.timezone="UTC"');
    expect(microsoftGraphPreferHeaderValue([undefined, null])).toBeUndefined();
  });
});

describe('canonicalizeMicrosoftGraphHeaders()', () => {
  it('canonicalises the names the client sets and keeps others', () => {
    expect(canonicalizeMicrosoftGraphHeaders({ 'content-type': 'text/plain', PREFER: 'x', ConsistencyLevel: 'eventual' })).toEqual({ 'Content-Type': 'text/plain', Prefer: 'x', ConsistencyLevel: 'eventual' });
  });
});

describe('readMicrosoftGraphRequiredScopesFromErrorMessage()', () => {
  it('reads the scopes a 403 says the call needs', () => {
    // models: the Teams 403 shape seen live in D6 (GET channel messages with a Read + Write token). The captured text sits in results-teams-onedrive.md on the machine that ran it; this string follows Graph's "API requires one of '…'" format
    const message = "Missing scope permissions on the request. API requires one of 'ChannelMessage.Read.All, ChannelMessage.ReadWrite, Group.Read.All, Group.ReadWrite.All'. Scopes on the request 'Chat.ReadWrite, Mail.Read, User.Read'";
    expect(readMicrosoftGraphRequiredScopesFromErrorMessage(message)).toEqual(['ChannelMessage.Read.All', 'ChannelMessage.ReadWrite', 'Group.Read.All', 'Group.ReadWrite.All']);
    expect(readMicrosoftGraphRequiredScopesFromErrorMessage('Access is denied.')).toEqual([]);
  });
});
