import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import yargs, { type Argv } from 'yargs';
import { withCallModelArgs } from './args';
import { isStdinPositionalSentinel, isStdinSentinel, readAllStdin, setCliRawArgv, STDIN_NOT_PIPED_ERROR_CODE } from './stdin';

/**
 * Parses `argv` through a real yargs parser and returns the argv the handler is given.
 *
 * The whole point of these tests is to cross the parser boundary: the sentinel helpers are
 * trivially correct in isolation, and the defect they guard against lives entirely in what yargs
 * hands a handler.
 */
async function parseThroughYargs(command: string, argv: string[], builder: (y: Argv) => Argv): Promise<Record<string, unknown>> {
  let captured: Record<string, unknown> = {};

  await yargs(argv)
    .command({
      command,
      builder,
      handler: (a: Record<string, unknown>) => {
        captured = a;
      }
    })
    .demandCommand(1)
    .fail(false)
    .parseAsync();

  return captured;
}

const GET_MANY_COMMAND = 'get-many <firstArg> [rest..]';
const getManyBuilder = (y: Argv): Argv => y.positional('firstArg', { type: 'string' }).positional('rest', { type: 'string', array: true, default: [] as string[] });

describe('stdin util', () => {
  beforeEach(() => {
    setCliRawArgv([]);
  });

  describe('isStdinSentinel', () => {
    it('matches a bare dash', () => {
      expect(isStdinSentinel('-')).toBe(true);
    });

    it('does not match an empty string, other values, or nullish', () => {
      expect(isStdinSentinel('')).toBe(false);
      expect(isStdinSentinel('sf/abc')).toBe(false);
      expect(isStdinSentinel(undefined)).toBe(false);
      expect(isStdinSentinel(null)).toBe(false);
    });
  });

  describe('isStdinPositionalSentinel', () => {
    it('matches a bare dash', () => {
      expect(isStdinPositionalSentinel('-')).toBe(true);
    });

    it('treats the empty positional yargs produces as the sentinel when argv held a dash', () => {
      setCliRawArgv(['get-many', '-']);
      expect(isStdinPositionalSentinel('')).toBe(true);
    });

    it('does NOT treat an empty positional as the sentinel when argv held no dash', () => {
      setCliRawArgv(['get-many', '']);
      expect(isStdinPositionalSentinel('')).toBe(false);
    });

    it('does not match ordinary values', () => {
      setCliRawArgv(['get-many', '-']);
      expect(isStdinPositionalSentinel('sf/abc')).toBe(false);
      expect(isStdinPositionalSentinel(undefined)).toBe(false);
    });
  });

  // Regression guard. yargs destroys a lone `-` positional before any handler runs, so a unit test
  // over the sentinel helper alone passes while `get-many -` is broken end to end.
  describe('yargs boundary — positional sentinel', () => {
    it('yargs coerces a lone dash positional to an empty string', async () => {
      const argv = await parseThroughYargs(GET_MANY_COMMAND, ['get-many', '-'], getManyBuilder);
      expect(argv['firstArg']).toBe('');
    });

    it('detects the sentinel from what yargs actually hands the handler', async () => {
      const rawArgv = ['get-many', '-'];
      setCliRawArgv(rawArgv);

      const argv = await parseThroughYargs(GET_MANY_COMMAND, rawArgv, getManyBuilder);

      expect(isStdinPositionalSentinel(argv['firstArg'])).toBe(true);
    });

    it('keeps trailing keys as rest when the first positional is the sentinel', async () => {
      const rawArgv = ['get-many', '-', 'sf/abc'];
      setCliRawArgv(rawArgv);

      const argv = await parseThroughYargs(GET_MANY_COMMAND, rawArgv, getManyBuilder);

      expect(isStdinPositionalSentinel(argv['firstArg'])).toBe(true);
      expect(argv['rest']).toEqual(['sf/abc']);
    });

    it('does not fire for an ordinary key', async () => {
      const rawArgv = ['get-many', 'sf/abc'];
      setCliRawArgv(rawArgv);

      const argv = await parseThroughYargs(GET_MANY_COMMAND, rawArgv, getManyBuilder);

      expect(isStdinPositionalSentinel(argv['firstArg'])).toBe(false);
      expect(argv['firstArg']).toBe('sf/abc');
    });
  });

  // `withCallModelArgs` declares `.nargs('data', 1)` precisely so this binds; without it yargs reads
  // the `-` as the next option and `--data` parses as boolean `true`, silently sending an empty payload.
  describe('yargs boundary — --data sentinel', () => {
    it('binds a bare dash as the --data value', async () => {
      const argv = await parseThroughYargs('call <model> <verb> [specifier]', ['call', 'gb', 'update', '--data', '-'], withCallModelArgs);

      expect(argv['data']).toBe('-');
      expect(isStdinSentinel(argv['data'])).toBe(true);
    });

    it('still binds an ordinary JSON payload', async () => {
      const argv = await parseThroughYargs('call <model> <verb> [specifier]', ['call', 'gb', 'update', '--data', '{"a":1}'], withCallModelArgs);

      expect(argv['data']).toBe('{"a":1}');
      expect(isStdinSentinel(argv['data'])).toBe(false);
    });
  });

  describe('readAllStdin', () => {
    const originalIsTTY = process.stdin.isTTY;

    afterEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    });

    it('throws rather than hanging when stdin is an interactive terminal', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

      await expect(readAllStdin()).rejects.toMatchObject({ code: STDIN_NOT_PIPED_ERROR_CODE });
    });
  });
});
