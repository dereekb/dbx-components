import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { buildEnumInfoCommand, type BuildEnumInfoCommandOptions } from './build-enum-info-command';
import { findReferencedCliEnums, renderCliEnumList, resolveCliEnumInfoListOutput, resolveCliEnumInfoLookupOutput } from './enum-info-utils';
import type { CliEnumManifest } from './types';

const ENUMS: CliEnumManifest = {
  JobWorkerTimesheetState: {
    name: 'JobWorkerTimesheetState',
    description: 'Timesheet state.',
    values: [
      { name: 'ACTIVE', value: 1, description: 'Active.' },
      { name: 'PAUSED', value: 2 },
      { name: 'ARCHIVED', value: 4 }
    ]
  },
  DayOfWeek: {
    name: 'DayOfWeek',
    values: [{ name: 'MON', value: 1 }]
  },
  JobTag: {
    name: 'JobTag',
    values: [{ name: 'PRIVATE_JOB', value: 'private', description: 'Private.' }]
  }
};

function runWith(argv: readonly string[], options?: BuildEnumInfoCommandOptions): void {
  const cmd = buildEnumInfoCommand(ENUMS, options);
  yargs([...argv])
    .command(cmd)
    .demandCommand(1)
    .strict()
    .fail(false)
    .exitProcess(false)
    .parseSync();
}

describe('buildEnumInfoCommand()', () => {
  let stdout: string[] = [];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  function stdoutJson(): any {
    return JSON.parse(stdout.join(''));
  }

  beforeEach(() => {
    stdout = [];
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((arg: any) => {
      stdout.push(String(arg));
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
      throw new Error(`process.exit:${code ?? 0}`);
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('with no names', () => {
    it('lists every enum with its value count', () => {
      runWith(['enum-info']);
      const output = stdout.join('');
      expect(output).toContain('ENUM');
      expect(output).toContain('VALUES');
      expect(output).toMatch(/JobWorkerTimesheetState\s+3\s+Timesheet state\./);
      expect(output).toMatch(/DayOfWeek\s+1/);
      expect(output).toContain('JobTag');
    });

    it('emits the sorted names under --json', () => {
      runWith(['enum-info', '--json']);
      expect(stdoutJson()).toEqual({ ok: true, data: { names: ['DayOfWeek', 'JobTag', 'JobWorkerTimesheetState'], total: 3 } });
    });
  });

  describe('with one name', () => {
    it('renders the enum heading, description, and values table', () => {
      runWith(['enum-info', 'JobWorkerTimesheetState']);
      const output = stdout.join('');
      expect(output).toContain('# JobWorkerTimesheetState');
      expect(output).toContain('Timesheet state.');
      expect(output).toMatch(/VALUE\s+NAME\s+DESCRIPTION/);
      expect(output).toMatch(/1\s+ACTIVE\s+Active\./);
      expect(output).not.toContain('Not found');
    });

    it('emits the manifest table under --json without notFound / hint', () => {
      runWith(['enum-info', 'JobWorkerTimesheetState', '--json']);
      const envelope = stdoutJson();
      expect(envelope.ok).toBe(true);
      expect(envelope.data.enums).toEqual([ENUMS['JobWorkerTimesheetState']]);
      expect(envelope.data).not.toHaveProperty('notFound');
      expect(envelope.data).not.toHaveProperty('hint');
    });

    it('trims surrounding whitespace before matching', () => {
      runWith(['enum-info', '  DayOfWeek  ', '--json']);
      expect(stdoutJson().data.enums.map((e: { readonly name: string }) => e.name)).toEqual(['DayOfWeek']);
    });

    it('omits the DESCRIPTION column when no value has a description', () => {
      runWith(['enum-info', 'DayOfWeek']);
      const output = stdout.join('');
      expect(output).toMatch(/VALUE\s+NAME/);
      expect(output).not.toContain('DESCRIPTION');
    });

    it('renders string values quoted and numbers bare', () => {
      runWith(['enum-info', 'JobTag', 'DayOfWeek']);
      const output = stdout.join('');
      expect(output).toMatch(/"private"\s+PRIVATE_JOB/);
      expect(output).toMatch(/^1\s+MON$/m);
    });
  });

  describe('with misses', () => {
    it('reports misses in notFound with a hint, keeping request order, and exits 0', () => {
      runWith(['enum-info', 'JobWorkerTimesheetState', 'Ghost', 'DayOfWeek', '--json']);
      const envelope = stdoutJson();
      expect(envelope.ok).toBe(true);
      expect(envelope.data.enums.map((e: { readonly name: string }) => e.name)).toEqual(['JobWorkerTimesheetState', 'DayOfWeek']);
      expect(envelope.data.notFound).toEqual(['Ghost']);
      expect(envelope.data.hint).toContain('`enum-info`');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('ends the text output with a Not found line', () => {
      runWith(['enum-info', 'JobWorkerTimesheetState', 'Ghost']);
      const output = stdout.join('');
      expect(output.trimEnd().split('\n').at(-1)).toMatch(/^Not found: Ghost\. Run `enum-info` with no arguments/);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('still succeeds when every name misses', () => {
      runWith(['enum-info', 'Ghost', 'Phantom', '--json']);
      const envelope = stdoutJson();
      expect(envelope.ok).toBe(true);
      expect(envelope.data.enums).toEqual([]);
      expect(envelope.data.notFound).toEqual(['Ghost', 'Phantom']);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('treats Object.prototype member names as misses', () => {
      runWith(['enum-info', 'constructor', 'toString', '__proto__', '--json']);
      const envelope = stdoutJson();
      expect(envelope.data.enums).toEqual([]);
      expect(envelope.data.notFound).toEqual(['constructor', 'toString', '__proto__']);
    });

    it('keeps a numeric-looking name a string', () => {
      runWith(['enum-info', '7', '--json']);
      expect(stdoutJson().data.notFound).toEqual(['7']);
    });
  });

  describe('with a blank name', () => {
    it.each([[''], ['   ']])('rejects %j with ENUM_INFO_INVALID_NAME and exit 1', (name) => {
      expect(() => runWith(['enum-info', name])).toThrow(/process\.exit:1/);
      const envelope = stdoutJson();
      expect(envelope.ok).toBe(false);
      expect(envelope.code).toBe('ENUM_INFO_INVALID_NAME');
    });
  });

  describe('definition', () => {
    it('pluralizes the enum count in describe', () => {
      expect(buildEnumInfoCommand(ENUMS).describe).toContain('(3 enums)');
      expect(buildEnumInfoCommand({ DayOfWeek: { name: 'DayOfWeek', values: [] } }).describe).toContain('(1 enum)');
    });

    it('honours a commandName override in the command and the hint', () => {
      runWith(['enums', 'Ghost', '--json'], { commandName: 'enums' });
      const envelope = stdoutJson();
      expect(envelope.data.notFound).toEqual(['Ghost']);
      expect(envelope.data.hint).toContain('`enums`');
    });
  });
});

describe('resolveCliEnumInfoListOutput()', () => {
  it('sorts the names', () => {
    expect(resolveCliEnumInfoListOutput(ENUMS)).toEqual({ names: ['DayOfWeek', 'JobTag', 'JobWorkerTimesheetState'], total: 3 });
  });
});

describe('resolveCliEnumInfoLookupOutput()', () => {
  it('keeps request order and duplicates', () => {
    const out = resolveCliEnumInfoLookupOutput({ names: ['JobTag', 'DayOfWeek', 'JobTag'], manifest: ENUMS });
    expect(out.enums.map((e) => e.name)).toEqual(['JobTag', 'DayOfWeek', 'JobTag']);
    expect(out).not.toHaveProperty('notFound');
  });

  it('defaults the hint to the enum-info command name', () => {
    const out = resolveCliEnumInfoLookupOutput({ names: ['Ghost'], manifest: ENUMS });
    expect(out.hint).toBe('Run `enum-info` with no arguments to list the registered enum names.');
  });
});

describe('findReferencedCliEnums()', () => {
  it('recurses into nested fields, dedupes, keeps first-reference order, and skips unknown names', () => {
    const tables = findReferencedCliEnums({
      manifest: ENUMS,
      fields: [
        { name: 'd', longName: 'day', optional: false, enumRef: 'DayOfWeek' },
        { name: 'x', longName: 'unknown', optional: false, enumRef: 'Ghost' },
        {
          name: 'g',
          longName: 'goals',
          optional: false,
          nestedIsArray: true,
          nestedFields: [
            { name: 's', longName: 'state', optional: false, enumRef: 'JobWorkerTimesheetState' },
            { name: 'd', longName: 'day', optional: false, enumRef: 'DayOfWeek' }
          ]
        }
      ]
    });
    expect(tables.map((e) => e.name)).toEqual(['DayOfWeek', 'JobWorkerTimesheetState']);
  });
});

describe('renderCliEnumList()', () => {
  it('returns an explanatory message for an empty manifest', () => {
    expect(renderCliEnumList({})).toMatch(/No enums found/);
  });

  it('truncates long enum descriptions', () => {
    const text = renderCliEnumList({ Long: { name: 'Long', description: 'x'.repeat(200), values: [] } });
    expect(text).toContain('x'.repeat(79) + '…');
    expect(text).not.toContain('x'.repeat(80));
  });
});
