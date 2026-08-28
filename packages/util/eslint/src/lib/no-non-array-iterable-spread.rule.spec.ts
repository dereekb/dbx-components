import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import * as ts from 'typescript';
import { UTIL_ESLINT_PLUGIN } from './plugin';

const TEST_PATH = '/virtual/test.ts';

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true
};

/**
 * Builds a TS `Program` over the in-memory test source so the rule receives real type information via
 * `parserOptions.programs`. The default host supplies the real lib files, which is what makes `Map`,
 * `Set` and their iterator types resolve.
 *
 * @param testSource - The source under test (written to `/virtual/test.ts`).
 * @returns A program whose checker can distinguish an array from a Map/Set iterator.
 */
function createProgram(testSource: string): ts.Program {
  const files: Record<string, string> = { [TEST_PATH]: testSource };
  const sources = new Map<string, ts.SourceFile>();

  for (const [name, content] of Object.entries(files)) {
    sources.set(name, ts.createSourceFile(name, content, COMPILER_OPTIONS.target ?? ts.ScriptTarget.ES2022, true));
  }

  const defaultHost = ts.createCompilerHost(COMPILER_OPTIONS);
  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (fileName, languageVersion, onError) => sources.get(fileName) ?? defaultHost.getSourceFile(fileName, languageVersion, onError),
    fileExists: (fileName) => sources.has(fileName) || defaultHost.fileExists(fileName),
    readFile: (fileName) => files[fileName] ?? defaultHost.readFile(fileName),
    writeFile: () => undefined,
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true
  };

  return ts.createProgram(Object.keys(files), COMPILER_OPTIONS, host);
}

function buildConfig(program: ts.Program): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tsParser as Linter.Parser,
        parserOptions: {
          programs: [program],
          ecmaVersion: 2022,
          sourceType: 'module'
        }
      },
      plugins: {
        'dereekb-util': UTIL_ESLINT_PLUGIN as never
      },
      rules: {
        'dereekb-util/no-non-array-iterable-spread': 'error'
      }
    }
  ];
}

function lintCode(testSource: string): Linter.LintMessage[] {
  // Flat config only matches files under the linter cwd, so the cwd must contain the virtual paths.
  const linter = new Linter({ configType: 'flat', cwd: '/virtual' });
  return linter.verify(testSource, buildConfig(createProgram(testSource)), { filename: TEST_PATH }).filter((m) => m.ruleId === 'dereekb-util/no-non-array-iterable-spread');
}

/**
 * Applies the fixes from a single lint pass to the source (end-to-start so offsets stay valid).
 *
 * @param testSource - The original source under test.
 * @returns The source with all reported fixes applied.
 */
function fixCode(testSource: string): string {
  const messages = lintCode(testSource);
  const fixes = messages
    .map((m) => m.fix)
    .filter((fix): fix is NonNullable<typeof fix> => fix != null)
    .sort((a, b) => b.range[0] - a.range[0]);

  let output = testSource;

  for (const fix of fixes) {
    output = output.slice(0, fix.range[0]) + fix.text + output.slice(fix.range[1]);
  }

  return output;
}

/**
 * Lints WITHOUT a program, exercising the syntactic fallback the workspace lint pass actually hits —
 * `eslint.config.mjs` configures no `projectService`/`project`, so a type-only rule would be decorative.
 */
function lintCodeWithoutTypes(testSource: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat', cwd: '/virtual' });
  const config: Linter.Config[] = [
    {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tsParser as Linter.Parser,
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
      },
      plugins: { 'dereekb-util': UTIL_ESLINT_PLUGIN as never },
      rules: { 'dereekb-util/no-non-array-iterable-spread': 'error' }
    }
  ];

  return linter.verify(testSource, config, { filename: TEST_PATH }).filter((m) => m.ruleId === 'dereekb-util/no-non-array-iterable-spread');
}

describe('no-non-array-iterable-spread rule', () => {
  describe('valid (not flagged)', () => {
    it('does not flag spreading a plain array', () => {
      expect(lintCode(`declare const arr: number[];\nconst a = [...arr];\n`)).toHaveLength(0);
    });

    it('does not flag spreading a readonly array', () => {
      expect(lintCode(`declare const arr: readonly number[];\nconst a = [...arr];\n`)).toHaveLength(0);
    });

    it('does not flag spreading a tuple', () => {
      expect(lintCode(`declare const t: [number, string];\nconst a = [...t];\n`)).toHaveLength(0);
    });

    it('does not flag spreading an any value', () => {
      expect(lintCode(`declare const x: any;\nconst a = [...x];\n`)).toHaveLength(0);
    });

    it('does not flag spreading an unconstrained type parameter', () => {
      expect(lintCode(`function f<T extends unknown[]>(x: T) {\n  return [...x];\n}\n`)).toHaveLength(0);
    });

    it('does not flag a CALL spread, which downlevels through apply()', () => {
      expect(lintCode(`declare const m: Map<string, number>;\ndeclare function f(...xs: number[]): void;\nf(...m.values());\n`)).toHaveLength(0);
    });

    it('does not flag an object spread', () => {
      expect(lintCode(`declare const o: { a: number };\nconst x = { ...o };\n`)).toHaveLength(0);
    });
  });

  describe('invalid (flagged)', () => {
    it('flags spreading Map.values()', () => {
      const errors = lintCode(`declare const m: Map<string, number>;\nconst a = [...m.values()];\n`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('m.values()');
    });

    it('flags spreading Map.keys()', () => {
      expect(lintCode(`declare const m: Map<string, number>;\nconst a = [...m.keys()];\n`)).toHaveLength(1);
    });

    it('flags spreading Map.entries()', () => {
      expect(lintCode(`declare const m: Map<string, number>;\nconst a = [...m.entries()];\n`)).toHaveLength(1);
    });

    it('flags spreading a Set directly', () => {
      expect(lintCode(`declare const s: Set<number>;\nconst a = [...s];\n`)).toHaveLength(1);
    });

    it('flags spreading a Map directly', () => {
      expect(lintCode(`declare const m: Map<string, number>;\nconst a = [...m];\n`)).toHaveLength(1);
    });

    it('flags spreading a generator result', () => {
      expect(lintCode(`function* gen(): Generator<number> {\n  yield 1;\n}\nconst a = [...gen()];\n`)).toHaveLength(1);
    });

    it('flags each unsafe spread in a multi-spread literal', () => {
      expect(lintCode(`declare const m: Map<string, number>;\ndeclare const s: Set<number>;\nconst a = [...m.values(), ...s];\n`)).toHaveLength(2);
    });

    it('flags a union whose branch is a non-array iterable', () => {
      expect(lintCode(`declare const x: number[] | Set<number>;\nconst a = [...x];\n`)).toHaveLength(1);
    });
  });

  describe('fixes', () => {
    it('rewrites a sole spread to Array.from()', () => {
      const output = fixCode(`declare const m: Map<string, number>;\nconst a = [...m.values()];\n`);
      expect(output).toContain('const a = Array.from(m.values());');
    });

    it('rewrites a sole Set spread to Array.from()', () => {
      const output = fixCode(`declare const s: Set<number>;\nconst a = [...s];\n`);
      expect(output).toContain('const a = Array.from(s);');
    });

    it('does NOT autofix a mixed literal, where order needs a restructure', () => {
      const source = `declare const m: Map<string, number>;\nconst a = [1, ...m.values()];\n`;
      expect(lintCode(source)).toHaveLength(1);
      expect(fixCode(source)).toBe(source);
    });
  });

  // The workspace lint pass has no projectService/project, so this is the path that actually runs there.
  describe('syntactic fallback (no type information)', () => {
    it('flags .values() / .keys() / .entries()', () => {
      expect(lintCodeWithoutTypes(`const a = [...m.values()];\n`)).toHaveLength(1);
      expect(lintCodeWithoutTypes(`const a = [...m.keys()];\n`)).toHaveLength(1);
      expect(lintCodeWithoutTypes(`const a = [...m.entries()];\n`)).toHaveLength(1);
    });

    it('flags a chained iterator call', () => {
      expect(lintCodeWithoutTypes(`const a = [...makeValuesGroupMap(xs, fn).values()];\n`)).toHaveLength(1);
    });

    it('flags new Set() / new Map()', () => {
      expect(lintCodeWithoutTypes(`const a = [...new Set(xs)];\n`)).toHaveLength(1);
      expect(lintCodeWithoutTypes(`const a = [...new Map(xs)];\n`)).toHaveLength(1);
    });

    it('does NOT flag Object.keys/values/entries, which return arrays', () => {
      expect(lintCodeWithoutTypes(`const a = [...Object.keys(o)];\n`)).toHaveLength(0);
      expect(lintCodeWithoutTypes(`const a = [...Object.values(o)];\n`)).toHaveLength(0);
      expect(lintCodeWithoutTypes(`const a = [...Object.entries(o)];\n`)).toHaveLength(0);
    });

    it('does NOT flag a bare identifier, which cannot be told from an array without types', () => {
      expect(lintCodeWithoutTypes(`const a = [...items];\n`)).toHaveLength(0);
    });

    it('autofixes a sole spread to Array.from()', () => {
      const messages = lintCodeWithoutTypes(`const a = [...m.values()];\n`);
      expect(messages[0].fix?.text).toBe('Array.from(m.values())');
    });
  });
});
