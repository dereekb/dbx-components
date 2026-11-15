import { describe, expect, it, vi } from 'vitest';
import { CliError, type CliTokenSourceToken } from '@dereekb/dbx-cli';
import { MicrosoftGraphError } from '@dereekb/microsoft';
import { type FetchResponseError } from '@dereekb/util/fetch';
import {
  MSGRAPH_CLI_ADMIN_CONSENT_REQUIRED_CODE,
  MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT,
  MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT,
  assertMsGraphCliAdminConsentScope,
  msGraphCliAdminConsentScopeError,
  msGraphCliAdminConsentStatus,
  msGraphCliAdminConsentTag,
  runMsGraphCliAdminConsentCall
} from './admin.consent';

function graphError(code: string, message: string, status: number): MicrosoftGraphError {
  return new MicrosoftGraphError({ code, message }, { response: new Response(null, { status }) } as unknown as FetchResponseError);
}

function tokenSource(scopes: string[]) {
  const token: CliTokenSourceToken = { accessToken: 't', scopes, expiresAt: '2099-01-01T00:00:00.000Z' };
  return { loadToken: vi.fn(async () => token) };
}

// the Read + Write preset's Teams scopes (live token, 2026-11-14)
const READ_WRITE_SCOPES = ['Chat.Read', 'Chat.ReadWrite', 'Channel.ReadBasic.All', 'ChannelMessage.Send', 'Team.ReadBasic.All', 'User.Read'];

describe('admin consent', () => {
  it('tags a command with its admin-consent scope', () => {
    expect(msGraphCliAdminConsentTag(MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT)).toBe('[org admin consent: ChannelMessage.Read.All]');
  });

  it('refuses before any Graph call when the token lacks the scope, naming the --dir alternative for chat search', async () => {
    const run = vi.fn(async () => 'ran');
    const error = await runMsGraphCliAdminConsentCall({ tokenSource: tokenSource(READ_WRITE_SCOPES), requirement: MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT, run }).catch((e: unknown) => e);

    expect(run).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe(MSGRAPH_CLI_ADMIN_CONSENT_REQUIRED_CODE);
    expect((error as CliError).suggestion).toContain('neither standard preset');
    expect((error as CliError).suggestion).toContain('--dir');
  });

  it('runs when the token holds the scope, in any casing or with the Graph resource prefix', async () => {
    const run = vi.fn(async () => 'ran');
    expect(await runMsGraphCliAdminConsentCall({ tokenSource: tokenSource([...READ_WRITE_SCOPES, 'https://graph.microsoft.com/channelmessage.read.all']), requirement: MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT, run })).toBe('ran');
  });

  it('lets a token that reports no scopes through, so Graph decides', async () => {
    await expect(assertMsGraphCliAdminConsentScope({ tokenSource: tokenSource([]), requirement: MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT })).resolves.toBeUndefined();
  });

  it('turns a 403 into SCOPE_DENIED saying no standard preset grants the scope, and leaves other errors alone', () => {
    // models: D6 live error text (channel messages read with a Read + Write token)
    const error = graphError('Forbidden', "Missing scope permissions on the request. API requires one of 'ChannelMessage.Read.All, Group.Read.All, Group.ReadWrite.All'. Scopes on the request 'Chat.ReadWrite, User.Read'", 403);
    const mapped = msGraphCliAdminConsentScopeError(error, MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT) as CliError;

    expect(mapped).toBeInstanceOf(CliError);
    expect(mapped.code).toBe('SCOPE_DENIED');
    expect(mapped.suggestion).toContain('neither standard preset');
    expect(mapped.suggestion).toContain('ChannelMessage.Read.All');

    const notFound = graphError('NotFound', 'x', 404);
    expect(msGraphCliAdminConsentScopeError(notFound, MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT)).toBe(notFound);
  });

  it('reports which admin-consent commands a token can run', () => {
    const status = msGraphCliAdminConsentStatus([...READ_WRITE_SCOPES, 'ChannelMessage.Read.All']);

    expect(status).toEqual([
      { command: 'teams chat search', scope: 'ChannelMessage.Read.All', available: true },
      { command: 'teams channel messages', scope: 'ChannelMessage.Read.All', available: true },
      { command: 'teams channel delete', scope: 'ChannelMessage.ReadWrite', available: false }
    ]);
  });
});
