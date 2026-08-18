import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_PREFER_CLEARABLE_ARKTYPE_RULE, type FirebasePreferClearableArktypeRuleOptions } from './prefer-clearable-arktype.rule';

const RULE_ID = 'dereekb-firebase/prefer-clearable-arktype';

function buildConfig(options?: FirebasePreferClearableArktypeRuleOptions): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'prefer-clearable-arktype': FIREBASE_PREFER_CLEARABLE_ARKTYPE_RULE } } as any },
      rules: { [RULE_ID]: options ? ['warn', options] : 'warn' }
    }
  ];
}

function lintCode(code: string, options?: FirebasePreferClearableArktypeRuleOptions): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

function fixCode(code: string, options?: FirebasePreferClearableArktypeRuleOptions): string {
  const linter = new Linter({ configType: 'flat' });
  return linter.verifyAndFix(code, buildConfig(options), { filename: 'test.ts' }).output;
}

const CLEARABLE_IMPORT = `import { clearable } from '@dereekb/model';`;
const ARKTYPE_IMPORT = `import { type } from 'arktype';`;

describe('prefer-clearable-arktype rule', () => {
  describe('valid', () => {
    it('allows a definition already wrapped in clearable()', () => {
      const errors = lintCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const updateWidgetParamsType = type({
  name: 'string >= 1',
  'description?': clearable('string')
});
`);
      expect(errors).toHaveLength(0);
    });

    it('ignores a nullish union outside an arktype definition call', () => {
      const errors = lintCode(`
export const NOT_A_DEFINITION = {
  'description?': 'string | null | undefined'
};
`);
      expect(errors).toHaveLength(0);
    });

    it('ignores the clearable() implementation itself (an .or() chain that is not a definition property)', () => {
      const errors = lintCode(`
export function clearable(definition: any): any {
  let result: any;

  if (typeof definition === 'string') {
    result = definition + ' | null | undefined';
  } else {
    result = definition.or('null').or('undefined');
  }

  return result;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('ignores a single-nullish definition by default', () => {
      const errors = lintCode(`
${ARKTYPE_IMPORT}

export const widgetParamsType = type({
  'description?': 'string | null'
});
`);
      expect(errors).toHaveLength(0);
    });

    it('ignores a definition with no nullish members', () => {
      const errors = lintCode(`
${ARKTYPE_IMPORT}

export const widgetParamsType = type({
  role: "'user' | 'system'"
});
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags an inline nullish union inside type({ … })', () => {
      const errors = lintCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const updateWidgetParamsType = type({
  'description?': 'string | null | undefined'
});
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('preferClearableDefinition');
      expect(errors[0].message).toContain("clearable('string')");
    });

    it('flags an inline nullish union inside someType.merge({ … })', () => {
      const errors = lintCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const updateWidgetParamsType = targetModelParamsType.merge({
  'tags?': 'string[] | null | undefined'
});
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("clearable('string[]')");
    });

    it('flags a nested definition object', () => {
      const errors = lintCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const widgetParamsType = type({
  config: {
    'notes?': 'string | null | undefined'
  }
});
`);
      expect(errors).toHaveLength(1);
    });

    it('flags an .or() chain that appends both nullish keywords', () => {
      const errors = lintCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const publishWidgetParamsType = type({
  'entries?': widgetEntryParamsType.array().or('null | undefined')
});
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('preferClearableOrChain');
      expect(errors[0].message).toContain('clearable(widgetEntryParamsType.array())');
    });

    it('flags a split .or("null").or("undefined") chain', () => {
      const errors = lintCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const publishWidgetParamsType = type({
  'entries?': widgetEntryParamsType.or('null').or('undefined')
});
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('clearable(widgetEntryParamsType)');
    });

    it('flags a single-nullish definition when includeSingleNullish is set', () => {
      const errors = lintCode(
        `
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const widgetParamsType = type({
  'description?': 'string | null'
});
`,
        { includeSingleNullish: true }
      );
      expect(errors).toHaveLength(1);
    });
  });

  describe('fixer', () => {
    it('rewrites the definition to clearable()', () => {
      const output = fixCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const updateWidgetParamsType = type({
  'description?': 'string | null | undefined'
});
`);
      expect(output).toContain(`'description?': clearable('string')`);
      expect(output).not.toContain('| null | undefined');
    });

    it('preserves the original quote style and inner unions', () => {
      const output = fixCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const widgetParamsType = type({
  'role?': "'user' | 'system' | null | undefined"
});
`);
      expect(output).toContain(`'role?': clearable("'user' | 'system'")`);
    });

    it('preserves a template literal definition and its holes', () => {
      const output = fixCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const widgetParamsType = type({
  'name?': \`string > 0 & string <= \${WIDGET_NAME_MAX_LENGTH} | null | undefined\`
});
`);
      expect(output).toContain('clearable(`string > 0 & string <= ${WIDGET_NAME_MAX_LENGTH}`)');
    });

    it('does not split a base definition on a nested pipe', () => {
      const output = fixCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const widgetParamsType = type({
  'code?': '/^(a|b)$/ | null | undefined'
});
`);
      expect(output).toContain(`clearable('/^(a|b)$/')`);
    });

    it('rewrites an .or() chain to clearable(receiver)', () => {
      const output = fixCode(`
${ARKTYPE_IMPORT}
${CLEARABLE_IMPORT}

export const publishWidgetParamsType = type({
  'entries?': widgetEntryParamsType.array().or('null | undefined')
});
`);
      expect(output).toContain(`'entries?': clearable(widgetEntryParamsType.array())`);
    });

    it('merges the helper into an existing @dereekb/model import', () => {
      const output = fixCode(`
${ARKTYPE_IMPORT}
import { type Clearable } from '@dereekb/model';

export const widgetParamsType = type({
  'description?': 'string | null | undefined'
});
`);
      expect(output).toContain(`import { clearable, type Clearable } from '@dereekb/model';`);
      expect(output.match(/@dereekb\/model/g)).toHaveLength(1);
    });

    it('adds a new import when the helper is not imported anywhere', () => {
      const output = fixCode(`
${ARKTYPE_IMPORT}

export const widgetParamsType = type({
  'description?': 'string | null | undefined'
});
`);
      expect(output).toContain(CLEARABLE_IMPORT);
      expect(output).toContain(`'description?': clearable('string')`);
    });

    it('adds the import exactly once when several properties are fixed', () => {
      const output = fixCode(`
${ARKTYPE_IMPORT}

export const widgetParamsType = type({
  'name?': 'string | null | undefined',
  'description?': 'string | null | undefined',
  'tags?': 'string[] | null | undefined'
});
`);
      expect(output.match(/import \{ clearable \} from '@dereekb\/model';/g)).toHaveLength(1);
      expect(output).toContain(`'name?': clearable('string')`);
      expect(output).toContain(`'description?': clearable('string')`);
      expect(output).toContain(`'tags?': clearable('string[]')`);
      expect(lintCode(output)).toHaveLength(0);
    });

    it('reports without a fix when no import can be anchored', () => {
      const code = `
export const widgetParamsType = type({
  'description?': 'string | null | undefined'
});
`;
      const errors = lintCode(code);
      expect(errors).toHaveLength(1);
      expect(errors[0].fix).toBeUndefined();
      expect(fixCode(code)).toBe(code);
    });

    it('does not add an import when autoImport is disabled', () => {
      const code = `
${ARKTYPE_IMPORT}

export const widgetParamsType = type({
  'description?': 'string | null | undefined'
});
`;
      const output = fixCode(code, { autoImport: false });
      expect(output).toBe(code);
    });
  });
});
