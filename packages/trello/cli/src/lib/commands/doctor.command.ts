import { CliError } from '@dereekb/dbx-cli';
import { getBoard, probeTrelloAuth } from '@dereekb/trello';
import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { trelloCliConfigStore, trelloCliPaths } from '../config/cli.config';
import { type TrelloCliCommand } from '../context/cli.command';
import { type TrelloCliContext } from '../context/cli.context';
import { TRELLO_CLI_NOT_CONFIGURED_SUGGESTION } from '../middleware/auth.middleware';

/**
 * One `doctor` finding.
 */
export interface TrelloCliDoctorCheck {
  readonly name: string;
  readonly status: 'pass' | 'warn' | 'fail';
  readonly message: string;
  readonly data?: unknown;
}

/**
 * A `doctor` check: built-in, or contributed by a plugin. It may return one finding or several.
 */
export type TrelloCliDoctorCheckFunction = (ctx: TrelloCliContext) => PromiseOrValue<TrelloCliDoctorCheck | readonly TrelloCliDoctorCheck[]>;

/**
 * Config for {@link trelloCliDoctorCommand}.
 */
export interface TrelloCliDoctorCommandConfig {
  /**
   * Extra checks to run after the built-in ones, read when the command runs (plugins add theirs after loading).
   */
  readonly checks?: Maybe<() => readonly { readonly source: string; readonly check: TrelloCliDoctorCheckFunction }[]>;
  /**
   * Extra report fields, e.g. the loaded plugins.
   */
  readonly report?: Maybe<() => Record<string, unknown>>;
}

/**
 * The built-in checks: the config file parses, credentials are configured and work, and the board (when set) resolves.
 *
 * @param ctx - The run's context.
 * @returns The findings.
 */
export async function trelloCliCoreDoctorChecks(ctx: TrelloCliContext): Promise<TrelloCliDoctorCheck[]> {
  const checks: TrelloCliDoctorCheck[] = [];

  try {
    await trelloCliConfigStore(trelloCliPaths()).loadConfigFile();
    checks.push({ name: 'config', status: 'pass', message: `config dir ${ctx.configDir}` });
  } catch (e) {
    checks.push({ name: 'config', status: 'fail', message: `the config file could not be read: ${(e as Error).message}` });
  }

  if (ctx.auth.mode === 'none') {
    checks.push({ name: 'auth', status: 'fail', message: `no credentials. ${TRELLO_CLI_NOT_CONFIGURED_SUGGESTION}` });
  } else {
    const probe = await probeTrelloAuth({ trelloContext: ctx.trelloContext });
    checks.push(probe.ok ? { name: 'auth', status: 'pass', message: `${ctx.auth.mode} via ${ctx.auth.source} as @${probe.member.username}` } : { name: 'auth', status: 'fail', message: `${ctx.auth.mode} via ${ctx.auth.source}: ${probe.code} ${probe.message}` });

    if (probe.ok && ctx.board != null) {
      try {
        const board = await getBoard(ctx.trelloContext)({ boardId: ctx.board });
        checks.push({ name: 'board', status: 'pass', message: `${board.name} (${board.id})` });
      } catch (e) {
        checks.push({ name: 'board', status: 'fail', message: `board "${ctx.board}" did not resolve: ${(e as Error).message}` });
      }
    }
  }

  if (ctx.board == null) {
    checks.push({ name: 'board', status: 'warn', message: 'no board set; board commands need --board, config default-board, or TRELLO_CLI_BOARD' });
  }

  return checks;
}

/**
 * Creates the `doctor` command: runs the built-in and plugin checks and fails (`DOCTOR_FAILED`, exit 1) when any fails.
 *
 * @param config - The extra checks and report fields.
 * @returns The command.
 */
export function trelloCliDoctorCommand(config: TrelloCliDoctorCommandConfig = {}): TrelloCliCommand {
  return {
    command: 'doctor',
    describe: 'Check the config, the credentials, the board and the loaded plugins',
    requires: 'none',
    handler: async (_argv, ctx) => {
      const checks: TrelloCliDoctorCheck[] = await trelloCliCoreDoctorChecks(ctx);

      for (const { source, check } of config.checks?.() ?? []) {
        try {
          const found = await check(ctx);
          checks.push(...(Array.isArray(found) ? found : [found as TrelloCliDoctorCheck]).map((x) => ({ ...x, name: `${source}:${x.name}` })));
        } catch (e) {
          checks.push({ name: `${source}:check`, status: 'fail', message: (e as Error).message });
        }
      }

      const report = { ok: checks.every((x) => x.status !== 'fail'), checks, ...config.report?.() };

      if (!report.ok) {
        throw new CliError({ message: `doctor found ${checks.filter((x) => x.status === 'fail').length} failing check(s).`, code: 'DOCTOR_FAILED', data: report });
      }

      ctx.output.result(report);
    }
  };
}
