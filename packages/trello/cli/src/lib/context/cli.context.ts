import { CliError } from '@dereekb/dbx-cli';
import { type TrelloBoardId, type TrelloContext, type TrelloMember, getMe } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { TRELLO_CLI_NAME, TRELLO_CLI_STATE_DIR_NAME } from '../config/cli.config';
import { outputTrelloCliNdjson, outputTrelloCliResult } from '../util/output';

/**
 * What a command needs before it runs:
 *
 * - `none`: nothing; `ctx.trelloContext` throws `NOT_CONFIGURED` if touched without credentials.
 * - `trello`: working credentials (the default). Without them the command fails with `NOT_CONFIGURED`, exit code 4.
 * - `board`: credentials plus a board (`--board`, config `defaultBoard`, or `TRELLO_CLI_BOARD`).
 */
export type TrelloCliCommandRequirement = 'none' | 'trello' | 'board';

/**
 * How the run authenticated:
 *
 * - `token-source`: an OAuth bearer token minted by a token-source command.
 * - `key-token`: an API key + token pair (env or saved).
 * - `host`: a host-built CLI supplied its own Trello context.
 * - `none`: no credentials were found (only `requires: 'none'` commands run).
 */
export type TrelloCliAuthMode = 'token-source' | 'key-token' | 'host' | 'none';

/**
 * The run's auth, without any secret.
 */
export interface TrelloCliAuthInfo {
  readonly mode: TrelloCliAuthMode;
  /**
   * Where the credentials came from, e.g. `env`, `config`, `flag`, or `token-source "dev" (config)`.
   */
  readonly source: string;
  /**
   * Where the key + token pair attachment downloads use came from, in `token-source` mode.
   *
   * Trello's attachment download endpoint refuses OAuth 2.0 bearer tokens, so a token-source run also picks up a
   * configured pair (`TRELLO_API_KEY` + `TRELLO_API_TOKEN`, then the `auth login` pair) for downloads only. Unset when
   * no pair is configured, and in the other modes, where downloads use the run's own credentials.
   */
  readonly downloadSource?: Maybe<string>;
}

/**
 * Prints command results.
 */
export interface TrelloCliOutput {
  /**
   * Prints the `{ ok: true, data, meta? }` envelope, applying `--pick`.
   */
  result(data: unknown, meta?: Maybe<Record<string, unknown>>): void;
  /**
   * Prints each item as one JSON line, without the envelope.
   */
  ndjson(items: Iterable<unknown>): void;
}

/**
 * Everything a trello-cli command — built-in or plugin — needs, injected so the same command runs in the stock
 * `trello-cli` binary and in a host-built CLI.
 */
export interface TrelloCliContext {
  /**
   * The binary name, for messages.
   */
  readonly cliName: string;
  /**
   * The authenticated Trello context every `@dereekb/trello` api function takes. Throws `NOT_CONFIGURED` when the
   * run has no credentials (only possible for a `requires: 'none'` command).
   */
  readonly trelloContext: TrelloContext;
  /**
   * The context attachment bytes are downloaded with: the key + token pair of {@link TrelloCliAuthInfo.downloadSource}
   * when one is set, else {@link trelloContext}. Use it for `downloadCardAttachment` / `syncTrelloCardAttachments`.
   */
  readonly downloadTrelloContext: TrelloContext;
  readonly auth: TrelloCliAuthInfo;
  /**
   * The board in effect (an id or shortLink), or undefined when none is set.
   */
  readonly board: Maybe<TrelloBoardId>;
  /**
   * Returns {@link board}, or throws `BOARD_REQUIRED`.
   */
  requireBoard(): TrelloBoardId;
  /**
   * The authenticated member, fetched once per run.
   */
  me(): Promise<TrelloMember>;
  readonly output: TrelloCliOutput;
  /**
   * Writes one line to stderr. Never write diagnostics to stdout: it carries the JSON envelope.
   */
  log(line: string): void;
  readonly signal: AbortSignal;
  /**
   * The command's own state directory (`<configDir>/state/<plugin name | core>`), created on first call.
   */
  stateDir(): string;
  now(): Date;
  /**
   * The CLI's config directory.
   */
  readonly configDir: string;
  /**
   * Clears a token source's cached token. The command wrapper calls it when Trello answers 401, so the next run mints
   * a fresh token. Absent for key+token and host auth.
   */
  readonly resetCredentials?: Maybe<() => Promise<void>>;
}

/**
 * Config for {@link createTrelloCliContext}.
 */
export interface CreateTrelloCliContextConfig {
  /**
   * The authenticated context, or undefined when the run has no credentials.
   */
  readonly trelloContext?: Maybe<TrelloContext>;
  /**
   * The context attachment downloads use. Defaults to {@link trelloContext}.
   */
  readonly downloadTrelloContext?: Maybe<TrelloContext>;
  /**
   * The error {@link TrelloCliContext.trelloContext} throws when there is no context. Defaults to a `NOT_CONFIGURED`.
   */
  readonly notConfiguredError?: Maybe<Error>;
  readonly auth?: Maybe<TrelloCliAuthInfo>;
  readonly board?: Maybe<TrelloBoardId>;
  readonly configDir: string;
  /**
   * The plugin whose command runs, which names the state directory. Defaults to the core directory.
   */
  readonly stateName?: Maybe<string>;
  readonly cliName?: Maybe<string>;
  readonly now?: Maybe<() => Date>;
  readonly signal?: Maybe<AbortSignal>;
  readonly resetCredentials?: Maybe<() => Promise<void>>;
  /**
   * Overrides the stderr writer. Used by specs.
   */
  readonly log?: Maybe<(line: string) => void>;
}

/**
 * The state directory name the built-in commands use.
 */
export const TRELLO_CLI_CORE_STATE_NAME = 'core';

/**
 * Builds a {@link TrelloCliContext}. A host-built CLI's `contextProvider` can use it to wrap its own Trello context.
 *
 * @param config - The Trello context, auth, board and paths.
 * @returns The context.
 *
 * @example
 * ```ts
 * const ctx = createTrelloCliContext({ trelloContext, auth: { mode: 'host', source: 'my-app' }, configDir: '/tmp/x' });
 * ```
 */
export function createTrelloCliContext(config: CreateTrelloCliContextConfig): TrelloCliContext {
  const cliName = config.cliName ?? TRELLO_CLI_NAME;
  const { trelloContext, board, configDir } = config;
  const stateName = config.stateName ?? TRELLO_CLI_CORE_STATE_NAME;
  const log = config.log ?? ((line: string) => process.stderr.write(`${line}\n`));
  let mePromise: Maybe<Promise<TrelloMember>>;

  const requireTrelloContext = (): TrelloContext => {
    if (trelloContext == null) {
      throw config.notConfiguredError ?? new CliError({ message: 'No Trello credentials are configured.', code: 'NOT_CONFIGURED', suggestion: `Run: ${cliName} auth login --key <key> --token <token>, set TRELLO_API_KEY + TRELLO_API_TOKEN, or set a token source.` });
    }

    return trelloContext;
  };

  return {
    cliName,
    get trelloContext() {
      return requireTrelloContext();
    },
    get downloadTrelloContext() {
      return config.downloadTrelloContext ?? requireTrelloContext();
    },
    auth: config.auth ?? { mode: trelloContext == null ? 'none' : 'host', source: trelloContext == null ? 'none' : 'host' },
    board,
    requireBoard: () => {
      if (board == null) {
        throw new CliError({ message: 'This command needs a board.', code: 'BOARD_REQUIRED', suggestion: `Pass --board <id|shortLink|url>, set one with: ${cliName} config set default-board <board>, or set TRELLO_CLI_BOARD.` });
      }

      return board;
    },
    me: () => {
      mePromise ??= getMe(requireTrelloContext())();
      return mePromise;
    },
    output: { result: outputTrelloCliResult, ndjson: outputTrelloCliNdjson },
    log,
    signal: config.signal ?? new AbortController().signal,
    stateDir: () => {
      const dir = join(configDir, TRELLO_CLI_STATE_DIR_NAME, stateName);
      mkdirSync(dir, { recursive: true });
      return dir;
    },
    now: config.now ?? (() => new Date()),
    configDir,
    resetCredentials: config.resetCredentials
  };
}
