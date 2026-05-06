import type { Argv } from 'yargs';

export interface EnvOptions {
  readonly env?: string;
}

export function withEnv<T>(yargs: Argv<T>): Argv<T & EnvOptions> {
  return yargs.option('env', {
    type: 'string',
    describe: 'Named env to target (overrides activeEnv in config and the *_ENV var)'
  }) as unknown as Argv<T & EnvOptions>;
}

export interface OutputOptions {
  readonly dumpDir?: string;
  readonly pick?: string;
  readonly pickAll?: boolean;
}

export function withOutput<T>(yargs: Argv<T>): Argv<T & OutputOptions> {
  return yargs.option('dump-dir', { type: 'string', describe: 'Directory to save full responses as JSON files (overrides config)' }).option('pick', { type: 'string', describe: 'Comma-separated top-level fields to include in output (overrides config)' }).option('pick-all', { type: 'boolean', describe: 'Ignore any configured pick filters and return full response data' }) as unknown as Argv<T & OutputOptions>;
}

export interface CallModelArgs {
  readonly model: string;
  readonly verb: string;
  readonly specifier?: string;
  readonly data?: string;
}

/**
 * Adds the standard generic-call positional + flag set: `<model> <verb> [specifier]` plus `--data <json>`.
 */
export function withCallModelArgs<T>(yargs: Argv<T>): Argv<T & CallModelArgs> {
  return yargs
    .positional('model', { type: 'string', demandOption: true, describe: 'Firestore model type (e.g. profile, guestbook)' })
    .positional('verb', {
      type: 'string',
      demandOption: true,
      describe: 'CRUD verb or custom action type (create, read, update, delete, query, or app-specific)'
    })
    .positional('specifier', { type: 'string', describe: 'Optional sub-function specifier' })
    .option('data', { type: 'string', describe: 'JSON-encoded payload (defaults to {} when omitted)' }) as unknown as Argv<T & CallModelArgs>;
}
