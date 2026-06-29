import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import * as ts from 'typescript';
import { UTIL_ESLINT_PLUGIN } from './plugin';

// A shared dependency module: a const enum (the case we flag) alongside a branded number alias and
// an interface (cases we must NOT flag). Cross-module so the import-conversion fixes are exercised.
const DEPS_PATH = '/virtual/deps.ts';
const TEST_PATH = '/virtual/test.ts';
const DEPS_SOURCE = `
export const enum Color {
  Red = 0,
  Green = 1,
  Blue = 2
}
export type EntityId = number & { readonly __brand: 'EntityId' };
export interface Other {
  readonly x: number;
}
`;

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true
};

/**
 * Builds a TS `Program` over two in-memory files (`deps.ts` + the test source) so the rule receives
 * real type information via `parserOptions.programs`.
 *
 * @param testSource - The source under test (written to `/virtual/test.ts`).
 * @returns A program whose checker resolves `Color` to a const enum and `EntityId` to a branded alias.
 */
function createProgram(testSource: string): ts.Program {
  const files: Record<string, string> = { [DEPS_PATH]: DEPS_SOURCE, [TEST_PATH]: testSource };
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
    useCaseSensitiveFileNames: () => true,
    // Explicit resolver: map a relative specifier (e.g. `./deps`) to its in-memory `.ts` source —
    // the default resolver bails because `/virtual` is not a real directory.
    resolveModuleNameLiterals: (literals, containingFile) =>
      literals.map((literal) => {
        const directory = containingFile.slice(0, containingFile.lastIndexOf('/'));
        const candidate = `${directory}/${literal.text.replace(/^\.\//, '')}.ts`;
        return { resolvedModule: sources.has(candidate) ? { resolvedFileName: candidate, extension: ts.Extension.Ts } : undefined };
      })
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
        'dereekb-util/no-enum-literal-cast': 'error'
      }
    }
  ];
}

function lintCode(testSource: string): Linter.LintMessage[] {
  // Flat config only matches files under the linter cwd, so the cwd must contain the virtual paths.
  const linter = new Linter({ configType: 'flat', cwd: '/virtual' });
  return linter.verify(testSource, buildConfig(createProgram(testSource)), { filename: TEST_PATH }).filter((m) => m.ruleId === 'dereekb-util/no-enum-literal-cast');
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

describe('no-enum-literal-cast rule', () => {
  describe('valid (not flagged)', () => {
    it('does not flag a branded number alias cast (no enum member exists)', () => {
      const errors = lintCode(`import type { EntityId } from './deps';\nconst id = 30 as EntityId;\n`);
      expect(errors).toHaveLength(0);
    });

    it('does not flag a literal asserted to an interface', () => {
      const errors = lintCode(`import type { Other } from './deps';\nconst o = { x: 1 } as Other;\n`);
      expect(errors).toHaveLength(0);
    });

    it('does not flag a proper enum member reference', () => {
      const errors = lintCode(`import { Color } from './deps';\nconst c = Color.Red;\n`);
      expect(errors).toHaveLength(0);
    });

    it('does not flag a non-literal cast to an enum', () => {
      const errors = lintCode(`import type { Color } from './deps';\ndeclare const n: number;\nconst c = n as Color;\n`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid (flagged)', () => {
    it('flags a literal asserted to a local enum and fixes to the member', () => {
      const code = `enum Color { Red = 0, Green = 1 }\nconst c = 0 as Color;\n`;
      const errors = lintCode(code);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('useEnumMember');
      expect(fixCode(code)).toContain('const c = Color.Red;');
    });

    it('flags an out-of-range literal cast without offering a fix', () => {
      const code = `enum Color { Red = 0, Green = 1 }\nconst c = 99 as Color;\n`;
      const errors = lintCode(code);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('unsafeEnumCast');
      expect(errors[0].fix).toBeUndefined();
    });

    it('converts an `import type` (multi-specifier) binding into a value import when fixing', () => {
      const code = `import type { Other, Color } from './deps';\nconst c = 1 as Color;\nconst o: Other = { x: 1 };\n`;
      const errors = lintCode(code);
      expect(errors).toHaveLength(1);

      const fixed = fixCode(code);
      expect(fixed).toContain('Color.Green');
      expect(fixed).toContain("import type { Other } from './deps';");
      expect(fixed).toContain("import { Color } from './deps';");
    });

    it('strips the declaration-level `type` for a sole-specifier `import type`', () => {
      const code = `import type { Color } from './deps';\nconst c = 2 as Color;\n`;
      const fixed = fixCode(code);
      expect(fixed).toContain('Color.Blue');
      expect(fixed).toContain("import { Color } from './deps';");
      expect(fixed).not.toContain('import type');
    });

    it('strips an inline `type` qualifier off the specifier', () => {
      const code = `import { type Color } from './deps';\nconst c = 0 as Color;\n`;
      const fixed = fixCode(code);
      expect(fixed).toContain('Color.Red');
      expect(fixed).toContain('import { Color }');
      expect(fixed).not.toContain('type Color');
    });
  });
});
