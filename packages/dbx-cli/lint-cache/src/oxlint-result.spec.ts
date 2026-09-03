import { describe, expect, it } from 'vitest';
import { extractJsonObject, oxlintRuleId, parseOxlintResult } from './oxlint-result.js';

describe('oxlint-result', () => {
  describe('extractJsonObject', () => {
    it('extracts the payload from the banner Nx prints around it', () => {
      const stdout = ['', '> nx run util:oxlint --format=json', '', '> oxlint . --format=json', '', '{ "diagnostics": [], "number_of_files": 379 }', '', ' NX   Successfully ran target oxlint for project util', ''].join('\n');

      expect(JSON.parse(extractJsonObject(stdout))).toEqual({ diagnostics: [], number_of_files: 379 });
    });

    it('does not terminate early on a brace inside a string literal', () => {
      const stdout = '> nx run x:oxlint\n{"diagnostics":[{"message":"unexpected } here","filename":"a.ts"}],"number_of_files":1}\ndone';
      const parsed = JSON.parse(extractJsonObject(stdout)) as { diagnostics: { message: string }[] };

      expect(parsed.diagnostics[0].message).toBe('unexpected } here');
    });

    it('does not terminate early on an escaped quote before a brace', () => {
      const stdout = String.raw`noise {"diagnostics":[{"message":"say \"}\" ok","filename":"a.ts"}],"number_of_files":1} trailing`;
      const parsed = JSON.parse(extractJsonObject(stdout)) as { number_of_files: number };

      expect(parsed.number_of_files).toBe(1);
    });

    it('throws when there is no JSON at all', () => {
      expect(() => extractJsonObject('no json here')).toThrow(/no JSON object found/);
    });

    it('throws when the object never closes', () => {
      expect(() => extractJsonObject('{"diagnostics": [')).toThrow(/unterminated/);
    });
  });

  describe('oxlintRuleId', () => {
    it('unwraps a plugin rule into plugin/rule form', () => {
      expect(oxlintRuleId('unicorn(no-empty-file)')).toBe('unicorn/no-empty-file');
    });

    it('strips the eslint namespace so core rule ids match the ESLint tier', () => {
      expect(oxlintRuleId('eslint(no-unsafe-optional-chaining)')).toBe('no-unsafe-optional-chaining');
    });

    it('returns null for a diagnostic with no rule (parse/config errors)', () => {
      expect(oxlintRuleId(null)).toBeNull();
      expect(oxlintRuleId(undefined)).toBeNull();
    });

    it('passes an unrecognized code through unchanged', () => {
      expect(oxlintRuleId('weird-code')).toBe('weird-code');
    });
  });

  describe('parseOxlintResult', () => {
    it('groups diagnostics by file, resolves paths against cwd, and maps severity', () => {
      const stdout = JSON.stringify({
        number_of_files: 12,
        diagnostics: [
          { code: 'eslint(no-unused-expressions)', severity: 'error', message: 'Expected expression to be used', filename: 'src/a.ts', labels: [{ span: { line: 4, column: 28 } }] },
          { code: 'unicorn(no-empty-file)', severity: 'warning', message: 'Empty files are not allowed.', filename: 'src/b.ts', labels: [{ span: { line: 1, column: 1 } }] },
          { code: 'eslint(no-empty-pattern)', severity: 'error', message: 'Empty object binding pattern', filename: 'src/a.ts', labels: [{ span: { line: 9, column: 3 } }] }
        ]
      });

      const result = parseOxlintResult({ stdout, cwd: '/ws/packages/util' });

      expect(result.fileCount).toBe(12);
      expect(result.files.map((f) => f.filePath)).toEqual(['/ws/packages/util/src/a.ts', '/ws/packages/util/src/b.ts']);

      const a = result.files[0];
      expect(a.messages).toHaveLength(2);
      expect(a.messages[0]).toEqual({ ruleId: 'no-unused-expressions', severity: 'error', message: 'Expected expression to be used', line: 4, column: 28, endLine: null, endColumn: null, fixable: false });

      const b = result.files[1];
      expect(b.messages[0].severity).toBe('warning');
      expect(b.messages[0].ruleId).toBe('unicorn/no-empty-file');
    });

    it('handles a clean run', () => {
      const result = parseOxlintResult({ stdout: '{"diagnostics":[],"number_of_files":379}', cwd: '/ws' });

      expect(result.files).toEqual([]);
      expect(result.fileCount).toBe(379);
    });

    it('keeps a diagnostic that has no rule and no span', () => {
      const stdout = JSON.stringify({ number_of_files: 1, diagnostics: [{ severity: 'error', message: 'Identifier `X` has already been declared', filename: 'src/a.ts' }] });

      const result = parseOxlintResult({ stdout, cwd: '/ws' });

      expect(result.files[0].messages[0]).toMatchObject({ ruleId: null, line: 0, column: 0, severity: 'error' });
    });
  });
});
