import { CliError } from '@dereekb/dbx-cli';
import { type TrelloCardAttachmentSync } from '@dereekb/trello/node';
import { type Maybe } from '@dereekb/util';
import { TRELLO_API_KEY_ENV_VAR, TRELLO_API_TOKEN_ENV_VAR, TRELLO_CLI_NAME } from '../config/cli.config';
import { type TrelloCliContext } from '../context/cli.context';
import { isTrelloServerErrorLike } from './output';

/**
 * The CLI error code for an attachment download Trello refused because the run only has an OAuth 2.0 bearer token.
 */
export const TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_ERROR_CODE = 'DOWNLOAD_NEEDS_KEY_TOKEN';

/**
 * What to do about a {@link TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_ERROR_CODE}.
 */
export const TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_SUGGESTION = `Trello's attachment download refuses OAuth 2.0 tokens. Set ${TRELLO_API_KEY_ENV_VAR} + ${TRELLO_API_TOKEN_ENV_VAR} (or run: ${TRELLO_CLI_NAME} auth login) for the same member; a token-source run then uses that pair for downloads only.`;

/**
 * Whether the run downloads attachments with an OAuth 2.0 bearer token alone: `token-source` mode with no key + token
 * pair for downloads. Trello answers such a download with a 401.
 *
 * @param ctx - The run's context.
 * @returns True when downloads have only the bearer token.
 */
export function isTrelloCliBearerOnlyDownload(ctx: Pick<TrelloCliContext, 'auth'>): boolean {
  return ctx.auth.mode === 'token-source' && ctx.auth.downloadSource == null;
}

/**
 * Rewrites the 401 of an attachment download on a bearer-only run (see {@link isTrelloCliBearerOnlyDownload}) into a
 * {@link TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_ERROR_CODE} `CliError`.
 *
 * The bearer token is not at fault there (it still reads the attachment), so the result is not a Trello server error and
 * the command wrapper keeps the token source's cached token instead of clearing it. Any other error is returned as is.
 *
 * @param error - The error the download threw.
 * @param ctx - The run's context.
 * @returns The error to throw.
 */
export function trelloCliDownloadError(error: unknown, ctx: Pick<TrelloCliContext, 'auth'>): unknown {
  return isTrelloCliBearerOnlyDownload(ctx) && isTrelloServerErrorLike(error) && error.status === 401
    ? new CliError({ message: 'Trello refused to download the attachment with the OAuth 2.0 token.', code: TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_ERROR_CODE, suggestion: TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_SUGGESTION })
    : error;
}

/**
 * The warning to add when an attachment sync on a bearer-only run had downloads fail, since each failure is reported
 * per entry rather than as the command's error.
 *
 * @param sync - The sync result.
 * @param ctx - The run's context.
 * @returns The warning, or undefined when the run has a download pair or no download failed.
 */
export function trelloCliAttachmentSyncWarning(sync: Pick<TrelloCardAttachmentSync, 'entries'>, ctx: Pick<TrelloCliContext, 'auth'>): Maybe<string> {
  return isTrelloCliBearerOnlyDownload(ctx) && sync.entries.some((x) => x.status === 'error') ? `Some attachments failed to download (${TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_ERROR_CODE}). ${TRELLO_CLI_DOWNLOAD_NEEDS_KEY_TOKEN_SUGGESTION}` : undefined;
}
