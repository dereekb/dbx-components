import { DISCORD_EPOCH_MS, compareDiscordSnowflakes, discordSnowflakeForDate, discordSnowflakeIsAfter, discordSnowflakeToDate } from './discord.snowflake';

const TEST_SNOWFLAKE = '1480401620608090182';
const TEST_SNOWFLAKE_DATE_ISO = '2026-03-09T03:07:30.885Z';

describe('discordSnowflakeToDate()', () => {
  it('should decode the creation time of a snowflake', () => {
    expect(discordSnowflakeToDate(TEST_SNOWFLAKE).toISOString()).toBe(TEST_SNOWFLAKE_DATE_ISO);
  });

  it('should not match the naive Number-based shift, which overflows int32', () => {
    // guards the BigInt implementation: Number(id) >> 22 coerces to a 32 bit integer, so every
    // modern snowflake decodes to a time within a second of the Discord epoch
    const naive = (Number(TEST_SNOWFLAKE) >> 22) + DISCORD_EPOCH_MS;

    expect(naive).toBe(1420070400197);
    expect(discordSnowflakeToDate(TEST_SNOWFLAKE).getTime()).not.toBe(naive);
    expect(discordSnowflakeToDate(TEST_SNOWFLAKE).getTime()).toBe(new Date(TEST_SNOWFLAKE_DATE_ISO).getTime());
  });

  it('should decode the discord epoch for a zero snowflake', () => {
    expect(discordSnowflakeToDate('0').getTime()).toBe(DISCORD_EPOCH_MS);
  });
});

describe('discordSnowflakeForDate()', () => {
  it('should build a snowflake that decodes back to the same date', () => {
    const date = new Date(TEST_SNOWFLAKE_DATE_ISO);
    const snowflake = discordSnowflakeForDate(date);

    expect(discordSnowflakeToDate(snowflake).getTime()).toBe(date.getTime());
  });

  it('should build the lowest snowflake for the date', () => {
    const date = new Date(TEST_SNOWFLAKE_DATE_ISO);
    const snowflake = discordSnowflakeForDate(date);

    expect(snowflake).toBe('1480401620607959040');
    // sorts before the real snowflake created in the same millisecond
    expect(discordSnowflakeIsAfter(TEST_SNOWFLAKE, snowflake)).toBe(true);
  });

  it('should return a zero snowflake for a date before the discord epoch', () => {
    expect(discordSnowflakeForDate(new Date(0))).toBe('0');
  });
});

describe('compareDiscordSnowflakes()', () => {
  it('should compare numerically rather than lexically', () => {
    // a shorter id is always older, but sorts AFTER the longer one as a string
    const older = '999999999999999999';
    const newer = '1480401620608090182';

    expect(compareDiscordSnowflakes(older, newer)).toBeLessThan(0);
    expect(compareDiscordSnowflakes(newer, older)).toBeGreaterThan(0);
    expect(older < newer).toBe(false); // the string comparison this replaces
  });

  it('should return zero for equal snowflakes', () => {
    expect(compareDiscordSnowflakes(TEST_SNOWFLAKE, TEST_SNOWFLAKE)).toBe(0);
  });

  it('should sort an array oldest-first', () => {
    const ids = ['1480401620608090182', '999999999999999999', '1480401620608090181'];
    expect([...ids].sort(compareDiscordSnowflakes)).toEqual(['999999999999999999', '1480401620608090181', '1480401620608090182']);
  });
});

describe('discordSnowflakeIsAfter()', () => {
  it('should return true when the first snowflake is newer', () => {
    expect(discordSnowflakeIsAfter('1480401620608090182', '1480401620608090181')).toBe(true);
  });

  it('should return false when the first snowflake is older', () => {
    expect(discordSnowflakeIsAfter('1480401620608090181', '1480401620608090182')).toBe(false);
  });

  it('should return false when the snowflakes are equal', () => {
    expect(discordSnowflakeIsAfter(TEST_SNOWFLAKE, TEST_SNOWFLAKE)).toBe(false);
  });

  it('should compare numerically rather than lexically', () => {
    expect(discordSnowflakeIsAfter('1480401620608090182', '999999999999999999')).toBe(true);
  });
});
