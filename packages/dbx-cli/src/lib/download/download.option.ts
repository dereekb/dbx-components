import { type Maybe, type Milliseconds } from '@dereekb/util';
import type { Argv } from 'yargs';
import { CliError } from '../util/output';
import { DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT } from './download.file';

/**
 * Adds `--idle-timeout <seconds>` to a downloading command.
 *
 * @param yargs - The command's yargs.
 * @param defaultIdleTimeout - The default the description names. Defaults to {@link DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT}.
 * @returns The yargs with the option.
 */
export function cliIdleTimeoutOption<T>(yargs: Argv<T>, defaultIdleTimeout: Milliseconds = DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT) {
  return yargs.option('idle-timeout', { type: 'number', describe: `Abort a download when no bytes arrive for this many seconds (default ${defaultIdleTimeout / 1000})` });
}

/**
 * Converts `--idle-timeout` seconds to milliseconds.
 *
 * @param seconds - The option value.
 * @returns The timeout, or undefined for the default.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not a positive number.
 */
export function cliIdleTimeoutMs(seconds: Maybe<number>): Maybe<Milliseconds> {
  if (seconds != null && !(Number.isFinite(seconds) && seconds > 0)) {
    throw new CliError({ message: `--idle-timeout must be a positive number of seconds, got ${seconds}.`, code: 'INVALID_ARGUMENT' });
  }

  return seconds == null ? undefined : Math.round(seconds * 1000);
}

/**
 * The default and the largest `--concurrency` of a command.
 */
export interface CliConcurrencyOptionConfig {
  readonly default: number;
  readonly max: number;
}

/**
 * Adds `--concurrency <n>` to a bulk-downloading command.
 *
 * @param yargs - The command's yargs.
 * @param config - The default and the largest value, named in the description.
 * @returns The yargs with the option.
 */
export function cliConcurrencyOption<T>(yargs: Argv<T>, config: CliConcurrencyOptionConfig) {
  return yargs.option('concurrency', { type: 'number', describe: `How many downloads run at once (default ${config.default}, max ${config.max})` });
}

/**
 * Validates `--concurrency`.
 *
 * @param value - The option value.
 * @param config - The default and the largest value.
 * @returns The value, or the default when unset.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not a whole number from 1 to the max.
 */
export function cliConcurrencyValue(value: Maybe<number>, config: CliConcurrencyOptionConfig): number {
  if (value != null && !(Number.isInteger(value) && value >= 1 && value <= config.max)) {
    throw new CliError({ message: `--concurrency must be a whole number from 1 to ${config.max}, got ${value}.`, code: 'INVALID_ARGUMENT' });
  }

  return value ?? config.default;
}
