import { type CliTokenSource, CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphScope, MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE, MICROSOFT_GRAPH_CHANNEL_MESSAGE_WRITE_SCOPE, MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_ADMIN_SCOPE, MicrosoftGraphError, isMicrosoftGraphScopeGranted } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { MSGRAPH_CLI_NAME } from '../config/cli.config';

/**
 * The error code of a command refused before any Graph call because the token lacks the admin-consent scope it needs.
 */
export const MSGRAPH_CLI_ADMIN_CONSENT_REQUIRED_CODE = 'ADMIN_CONSENT_REQUIRED';

/**
 * A command that needs a scope only a tenant admin can consent to, for the whole organization. Neither standard preset
 * (Read, Read + Write) carries one, so these commands run only on a connection an admin consented.
 */
export interface MsGraphCliAdminConsentCommand {
  /**
   * The command, e.g. `teams chat search`.
   */
  readonly command: string;
  /**
   * The admin-consent scope it needs.
   */
  readonly scope: MicrosoftGraphScope;
  /**
   * What to do without it, when there is another way.
   */
  readonly alternative?: Maybe<string>;
}

export const MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT: MsGraphCliAdminConsentCommand = {
  command: 'teams chat search',
  scope: MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_ADMIN_SCOPE,
  alternative: 'To search without it, archive the chats with teams chat dump and search the archive: teams chat search "<text>" --dir <dumpDir>.'
};
export const MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT: MsGraphCliAdminConsentCommand = { command: 'teams channel messages', scope: MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE };
export const MSGRAPH_CLI_TEAMS_CHANNEL_DELETE_ADMIN_CONSENT: MsGraphCliAdminConsentCommand = { command: 'teams channel delete', scope: MICROSOFT_GRAPH_CHANNEL_MESSAGE_WRITE_SCOPE };

/**
 * Every msgraph-cli command that needs organization (admin) consent. `auth show` reports which of them the active
 * token can run.
 */
export const MSGRAPH_CLI_ADMIN_CONSENT_COMMANDS: readonly MsGraphCliAdminConsentCommand[] = [MSGRAPH_CLI_TEAMS_CHAT_SEARCH_ADMIN_CONSENT, MSGRAPH_CLI_TEAMS_CHANNEL_MESSAGES_ADMIN_CONSENT, MSGRAPH_CLI_TEAMS_CHANNEL_DELETE_ADMIN_CONSENT];

/**
 * The tag a command's help carries when it needs organization consent.
 *
 * @param requirement - The command's requirement.
 * @returns E.g. `[org admin consent: ChannelMessage.Read.All]`.
 */
export function msGraphCliAdminConsentTag(requirement: Pick<MsGraphCliAdminConsentCommand, 'scope'>): string {
  return `[org admin consent: ${requirement.scope}]`;
}

function adminConsentExplanation(requirement: MsGraphCliAdminConsentCommand): string {
  return `${requirement.scope} needs a tenant admin's consent for the whole organization, and neither standard preset (Read, Read + Write) carries it, so ${requirement.command} only runs through a token source whose connection an admin consented with ${requirement.scope}.`;
}

function adminConsentSuggestion(requirement: MsGraphCliAdminConsentCommand): string {
  return [adminConsentExplanation(requirement), requirement.alternative, `Compare the token's scopes with: ${MSGRAPH_CLI_NAME} auth show`].filter(Boolean).join(' ');
}

/**
 * Refuses an admin-consent command before any Graph call when the token's granted scopes are known and lack its scope.
 * A token that reports no scopes is let through; Graph's 403 then decides.
 *
 * @param input - The token source and the command's requirement.
 * @param input.tokenSource - The run's token source; its token is minted when none is cached.
 * @param input.requirement - The command and the scope it needs.
 * @throws {CliError} {@link MSGRAPH_CLI_ADMIN_CONSENT_REQUIRED_CODE} when the token lacks the scope.
 */
export async function assertMsGraphCliAdminConsentScope(input: { readonly tokenSource: Pick<CliTokenSource, 'loadToken'>; readonly requirement: MsGraphCliAdminConsentCommand }): Promise<void> {
  const { requirement } = input;
  const { scopes } = await input.tokenSource.loadToken();

  if (scopes.length > 0 && !isMicrosoftGraphScopeGranted(scopes, requirement.scope)) {
    throw new CliError({ message: `${requirement.command} needs ${requirement.scope} (organization admin consent), which this token does not have.`, code: MSGRAPH_CLI_ADMIN_CONSENT_REQUIRED_CODE, suggestion: adminConsentSuggestion(requirement) });
  }
}

/**
 * Turns the 403 of an admin-consent command into a `SCOPE_DENIED` that explains no standard preset grants the scope.
 *
 * @param error - The thrown value.
 * @param requirement - The command and the scope it needs.
 * @returns The mapped error, or the original when it is not a 403.
 */
export function msGraphCliAdminConsentScopeError(error: unknown, requirement: MsGraphCliAdminConsentCommand): unknown {
  let result = error;

  if (error instanceof MicrosoftGraphError && error.status === 403) {
    result = new CliError({ message: error.message, code: 'SCOPE_DENIED', suggestion: adminConsentSuggestion(requirement) });
  }

  return result;
}

/**
 * Runs an admin-consent command's Graph calls: refuses first when the token lacks the scope
 * ({@link assertMsGraphCliAdminConsentScope}), then maps a 403 to the admin-consent suggestion.
 *
 * @param input - The token source, the requirement and the call.
 * @param input.tokenSource - The run's token source.
 * @param input.requirement - The command and the scope it needs.
 * @param input.run - The Graph calls.
 * @returns The call's result.
 */
export async function runMsGraphCliAdminConsentCall<T>(input: { readonly tokenSource: Pick<CliTokenSource, 'loadToken'>; readonly requirement: MsGraphCliAdminConsentCommand; readonly run: () => Promise<T> }): Promise<T> {
  await assertMsGraphCliAdminConsentScope(input);

  try {
    return await input.run();
  } catch (e) {
    throw msGraphCliAdminConsentScopeError(e, input.requirement);
  }
}

/**
 * One admin-consent command in `auth show`'s report.
 */
export interface MsGraphCliAdminConsentCommandStatus {
  readonly command: string;
  readonly scope: MicrosoftGraphScope;
  /**
   * Whether the token holds the scope.
   */
  readonly available: boolean;
}

/**
 * Reports which admin-consent commands a token can run.
 *
 * @param scopes - The token's granted scopes.
 * @returns One entry per command in {@link MSGRAPH_CLI_ADMIN_CONSENT_COMMANDS}.
 */
export function msGraphCliAdminConsentStatus(scopes: Maybe<readonly string[]>): MsGraphCliAdminConsentCommandStatus[] {
  return MSGRAPH_CLI_ADMIN_CONSENT_COMMANDS.map((x) => ({ command: x.command, scope: x.scope, available: isMicrosoftGraphScopeGranted(scopes, x.scope) }));
}
