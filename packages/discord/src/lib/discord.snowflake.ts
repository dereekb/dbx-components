import { type Milliseconds } from '@dereekb/util';
import { type DiscordSnowflake } from './discord.type';

/**
 * The Discord epoch, the first second of 2015, expressed as a unix timestamp in milliseconds.
 *
 * Every snowflake encodes its creation time as an offset from this value.
 */
export const DISCORD_EPOCH_MS: Milliseconds = 1420070400000;

/**
 * The number of low bits in a snowflake reserved for the worker id, process id, and increment.
 *
 * The timestamp occupies every bit above these.
 */
export const DISCORD_SNOWFLAKE_TIMESTAMP_SHIFT = 22n;

/**
 * Returns the creation time encoded in the input snowflake.
 *
 * The arithmetic is performed with BigInt: a snowflake exceeds 53 bits, so the naive
 * `Number(snowflake) >> 22` coerces to a 32-bit integer and returns a time near the Discord
 * epoch for every modern id.
 *
 * @param snowflake - The snowflake id to read the timestamp from.
 * @returns The Date the snowflake was created at.
 *
 * @example
 * ```ts
 * discordSnowflakeToDate('1480401620608090182'); // 2026-03-09T03:07:30.885Z
 * ```
 */
export function discordSnowflakeToDate(snowflake: DiscordSnowflake): Date {
  const timestamp = (BigInt(snowflake) >> DISCORD_SNOWFLAKE_TIMESTAMP_SHIFT) + BigInt(DISCORD_EPOCH_MS);
  return new Date(Number(timestamp));
}

/**
 * Returns the lowest snowflake id that could have been created at the input date.
 *
 * Useful as a `before`/`after` pagination bound: an id built this way sorts before every real
 * message created in the same millisecond, so it can bound a scan by time without knowing any
 * actual message id.
 *
 * @param date - The date to build a snowflake bound for.
 * @returns The lowest snowflake id for that millisecond.
 *
 * @example
 * ```ts
 * const twoWeeksAgo = discordSnowflakeForDate(addDays(new Date(), -14));
 * ```
 */
export function discordSnowflakeForDate(date: Date): DiscordSnowflake {
  const offset = BigInt(date.getTime()) - BigInt(DISCORD_EPOCH_MS);
  const snowflake = offset > 0n ? offset << DISCORD_SNOWFLAKE_TIMESTAMP_SHIFT : 0n;
  return snowflake.toString();
}

/**
 * Compares two snowflakes by their numeric value.
 *
 * Compared as BigInt values rather than strings: a plain string comparison is only correct for
 * ids of equal length, and snowflake ids grow a digit over time.
 *
 * @param a - The first snowflake.
 * @param b - The second snowflake.
 * @returns A negative number when a is older than b, a positive number when a is newer, and 0 when equal.
 */
export function compareDiscordSnowflakes(a: DiscordSnowflake, b: DiscordSnowflake): number {
  const aValue = BigInt(a);
  const bValue = BigInt(b);
  let result: number;

  if (aValue < bValue) {
    result = -1;
  } else if (aValue > bValue) {
    result = 1;
  } else {
    result = 0;
  }

  return result;
}

/**
 * Returns true if snowflake a was created after snowflake b.
 *
 * @param a - The snowflake to test.
 * @param b - The snowflake to test against.
 * @returns True when a is strictly newer than b.
 *
 * @example
 * ```ts
 * discordSnowflakeIsAfter('1480401620608090182', '1480401620608090181'); // true
 * ```
 */
export function discordSnowflakeIsAfter(a: DiscordSnowflake, b: DiscordSnowflake): boolean {
  return BigInt(a) > BigInt(b);
}
