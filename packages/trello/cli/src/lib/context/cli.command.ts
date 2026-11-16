import { CLI_EXIT_CODE_AUTH, CLI_EXIT_CODE_HANDLER, outputError } from '@dereekb/dbx-cli';
import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { getTrelloCliContext } from '../middleware/auth.middleware';
import { isTrelloServerErrorLike } from '../util/output';
import { type TrelloCliCommandRequirement, type TrelloCliContext } from './cli.context';

/**
 * A trello-cli command, built-in or contributed by a plugin.
 *
 * The handler gets the parsed arguments and an injected {@link TrelloCliContext}, so the command never builds its own
 * Trello client and runs unchanged in the stock binary and in a host-built CLI.
 */
export interface TrelloCliCommand {
  /**
   * The yargs command string, e.g. `get <card>`.
   */
  readonly command: string;
  readonly describe: string;
  readonly aliases?: Maybe<readonly string[]>;
  /**
   * Declares the positionals and options (and may add raw yargs subcommands).
   */
  readonly builder?: Maybe<(yargs: Argv) => Argv>;
  /**
   * What the command needs before it runs. Defaults to `trello`.
   */
  readonly requires?: Maybe<TrelloCliCommandRequirement>;
  /**
   * Nested commands, e.g. the `get` / `create` of `card`.
   */
  readonly subcommands?: Maybe<readonly TrelloCliCommand[]>;
  /**
   * Runs the command. A group with `subcommands` may omit it, which then demands a subcommand.
   */
  readonly handler?: Maybe<(argv: Arguments, ctx: TrelloCliContext) => PromiseOrValue<void>>;
}

/**
 * Config for {@link trelloCliYargsCommand}.
 */
export interface TrelloCliYargsCommandConfig {
  /**
   * The plugin the command belongs to; names the context's state directory.
   */
  readonly pluginName?: Maybe<string>;
  /**
   * Resolves the context. Defaults to {@link getTrelloCliContext}.
   */
  readonly getContext?: Maybe<(argv: Arguments, requires: TrelloCliCommandRequirement, pluginName: Maybe<string>) => Promise<TrelloCliContext>>;
}

/**
 * The first word of a yargs command string — the name the command is invoked by.
 *
 * @param command - The command string, e.g. `get <card>`.
 * @returns The name, e.g. `get`.
 */
export function trelloCliCommandName(command: Pick<TrelloCliCommand, 'command'>): string {
  return command.command.trim().split(/\s+/)[0];
}

/**
 * Converts a {@link TrelloCliCommand} (and its subcommands) into a yargs command module.
 *
 * The handler resolves the context first: a credential failure prints the error envelope and exits 4 (`NOT_CONFIGURED`),
 * a missing board for `requires: 'board'` prints `BOARD_REQUIRED` and exits 1, and any error the handler throws prints
 * its envelope and exits 1. On a Trello 401 the token source's cached token is cleared first.
 *
 * @param command - The command.
 * @param config - The plugin name and the context resolver.
 * @returns The yargs command module.
 */
export function trelloCliYargsCommand(command: TrelloCliCommand, config: TrelloCliYargsCommandConfig = {}): CommandModule {
  const { pluginName } = config;
  const getContext = config.getContext ?? getTrelloCliContext;
  const requires = command.requires ?? 'trello';
  const subcommands = command.subcommands ?? [];
  const handler = command.handler;

  return {
    command: command.command,
    describe: command.describe,
    ...(command.aliases ? { aliases: [...command.aliases] } : {}),
    builder: (yargs: Argv) => {
      let next = command.builder ? command.builder(yargs) : yargs;

      for (const subcommand of subcommands) {
        next = next.command(trelloCliYargsCommand(subcommand, config));
      }

      if (handler == null && subcommands.length > 0) {
        next = next.demandCommand(1, `Please specify a ${trelloCliCommandName(command)} subcommand.`);
      }

      return next;
    },
    handler: async (argv: Arguments) => {
      if (handler != null) {
        let ctx: Maybe<TrelloCliContext>;

        try {
          ctx = await getContext(argv, requires, pluginName);
        } catch (e) {
          outputError(e);
          process.exit(CLI_EXIT_CODE_AUTH);
        }

        if (ctx != null) {
          try {
            if (requires === 'board') {
              ctx.requireBoard();
            }

            await handler(argv, ctx);
          } catch (e) {
            if (isTrelloServerErrorLike(e) && e.status === 401) {
              await ctx.resetCredentials?.().catch(() => undefined);
            }

            outputError(e);
            process.exit(CLI_EXIT_CODE_HANDLER);
          }
        }
      }
    }
  };
}
