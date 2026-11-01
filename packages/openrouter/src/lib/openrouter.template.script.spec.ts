import { describe, expect, it } from 'vitest';
import { TEST_BAD_TEMPLATE_SCRIPTS, TEST_GOOD_TEMPLATE_SCRIPTS, TEST_JOB_REMINDER_TEMPLATE_TYPE, TEST_OPENROUTER_TEMPLATE_TYPE, TEST_PROFILE_TEXT_TEMPLATE_TYPE } from '../test/openrouter.template.fixture';
import { OPENROUTER_TEMPLATE_BANNED_NAMES, OPENROUTER_TEMPLATE_EXCLUDED_MEMBER_NAMES } from './openrouter.template';
import { OPENROUTER_TEMPLATE_SCRIPT_MAX_LENGTH, type ValidateOpenRouterTemplateScriptConfig, validateOpenRouterTemplateScript } from './openrouter.template.script';
import { type OpenRouterTemplateTypeConfig } from './openrouter.template.type';

function validate(code: string, typeConfig: OpenRouterTemplateTypeConfig = TEST_JOB_REMINDER_TEMPLATE_TYPE, extra?: Partial<ValidateOpenRouterTemplateScriptConfig>) {
  return validateOpenRouterTemplateScript({ code, typeConfig, ...extra });
}

function expectValid(code: string, typeConfig?: OpenRouterTemplateTypeConfig, extra?: Partial<ValidateOpenRouterTemplateScriptConfig>): void {
  const result = validate(code, typeConfig, extra);
  expect(result.errors).toEqual([]);
  expect(result.valid).toBe(true);
}

function expectInvalid(code: string, typeConfig?: OpenRouterTemplateTypeConfig, extra?: Partial<ValidateOpenRouterTemplateScriptConfig>): void {
  const result = validate(code, typeConfig, extra);
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
}

describe('validateOpenRouterTemplateScript()', () => {
  describe('good scripts', () => {
    Object.entries(TEST_GOOD_TEMPLATE_SCRIPTS).forEach(([name, code]) => {
      it(`should accept the ${name} script`, () => {
        expectValid(code);
      });
    });

    it('should report the loaders a script uses', () => {
      expect(validate(TEST_GOOD_TEMPLATE_SCRIPTS['jobReminder']).usedLoaders.sort()).toEqual(['loadJobs', 'loadWorker']);
    });

    it('should accept direct destructuring of the input and a loader result', () => {
      expectValid(`const { workerKey } = context.input; const { firstName } = await context.loadWorker(); return workerKey + firstName;`);
    });

    it('should accept an awaited loader result read in place', () => {
      expectValid(`return (await context.loadWorker()).firstName;`);
    });

    it('should accept const helpers, built-ins and conversions', () => {
      expectValid(`const fmt = (job) => job.title.toUpperCase();
const jobs = await context.loadJobs();
let text = jobs.map(fmt).filter(Boolean).join(', ');
text += ' ' + String(Math.max(jobs.length, 1)) + ' ' + Number.isFinite(jobs.length);
if (!Array.isArray(jobs) || -jobs.length > 0) {
  return null;
}
return text.slice(0, 100).trim();`);
    });

    it('should accept a callback passed to reduce', () => {
      expectValid(`const jobs = await context.loadJobs(); return jobs.reduce((acc, job) => acc + job.title, '');`);
    });

    it('should accept a comment telling the reviewer to approve, which only the review can catch', () => {
      expectValid(TEST_BAD_TEMPLATE_SCRIPTS['reviewerComment']);
    });
  });

  describe('known-bad scripts', () => {
    Object.entries(TEST_BAD_TEMPLATE_SCRIPTS)
      .filter(([name]) => name !== 'reviewerComment')
      .forEach(([name, code]) => {
        it(`should refuse the ${name} script`, () => {
          expectInvalid(code);
        });
      });
  });

  describe('rejected constructs', () => {
    const cases: Record<string, string> = {
      this: `return this;`,
      new: `return new Array(3);`,
      forLoop: `for (let i = 0; i < 1; i += 1) {} return 'x';`,
      forIn: `for (const k in context.input) {} return 'x';`,
      forOf: `const jobs = await context.loadJobs(); for (const j of jobs) {} return 'x';`,
      whileLoop: `while (true) {} return 'x';`,
      doWhile: `do {} while (true); return 'x';`,
      dynamicImport: `await import('fs'); return 'x';`,
      classDeclaration: `class A {} return 'x';`,
      classExpression: `const A = class {}; return 'x';`,
      getter: `const o = { get text() { return 'x'; } }; return o;`,
      setter: `const o = { set text(v) {} }; return 'x';`,
      method: `const o = { text() { return 'x'; } }; return 'x';`,
      with: `with (context) {} return 'x';`,
      eval: `return eval('1');`,
      functionGlobal: `return Function('return 1')();`,
      functionDeclaration: `function f() { return 1; } return 'x';`,
      functionExpression: `const f = function () { return 1; }; return 'x';`,
      arguments: `const f = () => arguments; return f();`,
      computedBuiltName: `const k = 'length'; return context.input.workerKey[k];`,
      computedTemplate: 'return context.input[`workerKey`];',
      spreadArray: `const jobs = await context.loadJobs(); return [...jobs].join('');`,
      spreadObject: `const w = await context.loadWorker(); return { ...w };`,
      spreadArgument: `const jobs = await context.loadJobs(); return Math.max(...jobs);`,
      restPattern: `const [a, ...rest] = await context.loadJobs(); return 'x';`,
      restObjectPattern: `const { firstName, ...rest } = await context.loadWorker(); return 'x';`,
      defaultPattern: `const { nickname = 'x' } = await context.loadWorker(); return 'x';`,
      defaultParam: `const f = (a = 1) => a; return f();`,
      taggedTemplate: 'return String.raw`x`;',
      regex: `return 'abc'.replace(/a/g, 'b');`,
      bigint: `return String(10n);`,
      asyncArrow: `const f = async () => 1; return 'x';`,
      selfRecursion: `const f = (n) => (n > 0 ? f(n - 1) : 0); return String(f(3));`,
      forwardRecursion: `const a = (n) => b(n); const b = (n) => a(n); return String(a(1));`,
      callArray: `return Array(3).join('x');`,
      shadowContext: `const context = 1; return 'x';`,
      shadowGlobal: `const Math = 1; return 'x';`,
      paramShadowContext: `const f = (context) => context; return 'x';`,
      memberAssignment: `const o = { text: 'a' }; o.text = 'b'; return o;`,
      constAssignment: `const a = 'x'; a = 'y'; return a;`,
      paramAssignment: `const f = (a) => { a = 1; return a; }; return 'x';`,
      compoundAssignment: `let a = 1; a *= 2; return 'x';`,
      nestedAssignment: `let a = 1; let b = 2; a = b = 3; return 'x';`,
      var: `var a = 'x'; return a;`,
      switch: `switch (1) { case 1: return 'x'; } return 'y';`,
      try: `try { return 'x'; } catch (e) { return 'y'; }`,
      throw: `throw 'x';`,
      label: `a: { return 'x'; }`,
      debugger: `debugger; return 'x';`,
      directive: `'use strict'; return 'x';`,
      sequence: `return (1, 'x');`,
      update: `let a = 1; a++; return 'x';`,
      typeof: `return typeof context.input;`,
      void: `return void 0;`,
      delete: `const o = { text: 'a' }; delete o.text; return 'x';`,
      looseEquals: `return 1 == 1 ? 'x' : 'y';`,
      looseNotEquals: `return 1 != 1 ? 'x' : 'y';`,
      inOperator: `return 'workerKey' in context.input ? 'x' : 'y';`,
      instanceofOperator: `return [] instanceof Array ? 'x' : 'y';`,
      bitwise: `return String(1 | 2);`,
      undefinedGlobal: `return undefined;`,
      unknownGlobal: `return Object.keys(context.input).join('');`,
      bareContext: `return JSON.stringify(context);`,
      contextAlias: `const c = context; return 'x';`,
      contextDestructure: `const { input } = context; return 'x';`,
      unknownContextMember: `return context.secrets;`,
      contextIndex: `return context[0];`,
      loaderAsValue: `const l = context.loadWorker; return 'x';`,
      loaderWithArguments: `const w = await context.loadWorker('other'); return w.firstName;`,
      loaderNotAwaited: `return context.loadWorker().firstName;`,
      undeclaredInputPath: `return context.input.title;`,
      undeclaredLoaderPath: `const worker = await context.loadWorker(); return worker.title;`,
      undeclaredDestructure: `const { title } = context.input; return title;`,
      undeclaredCallbackPath: `const jobs = await context.loadJobs(); return jobs.map((job) => job.firstName).join('');`,
      unknownProperty: `return context.input.secretField;`,
      methodAsValue: `const t = context.input.workerKey.trim; return 'x';`,
      callDataField: `return context.input.workerKey();`,
      callLength: `return String(context.input.workerKey.length());`,
      callNonArrowBinding: `const a = 'x'; return a();`,
      callLetArrow: `let f = () => 1; return 'x';`,
      callCallResult: `const f = (a) => a; return String(f(1)(2));`,
      functionReturnedFromArrow: `const f = () => 1; const g = () => f; return 'x';`,
      functionInObject: `const f = () => 1; return { text: f };`,
      functionInArray: `const f = () => 1; const a = [f]; return 'x';`,
      functionInConditional: `const f = () => 1; const g = () => 2; const h = true ? f : g; return 'x';`,
      functionAsReduceInitial: `const f = () => 1; const jobs = await context.loadJobs(); return String(jobs.reduce((acc) => acc, f));`,
      functionThroughObjectMethod: `const f = (o, n) => (n > 0 ? o.map(o, n - 1) + o.map(o, n - 1) : 1); return String(f({ map: f }, 30));`,
      arrowOutsideCallback: `return String((() => 1)());`,
      privateName: `const o = { text: 'a' }; return o.#x;`,
      negativeIndex: `const jobs = await context.loadJobs(); return jobs[-1].title;`,
      fractionalIndex: `const jobs = await context.loadJobs(); return jobs[1.5].title;`,
      numberKey: `return { 1: 'x' };`,
      computedKey: `return { ['text']: 'x' };`,
      infinityLiteral: `return String(1e999);`,
      unicodeEscapedIdentifier: String.raw`return [].\u0063onstructor;`,
      unicodeEscapedString: String.raw`return []['\u0063onstructor'];`,
      unicodeEscapedKey: String.raw`return { '\u005f\u005fproto\u005f\u005f': null };`,
      thenKey: `return { then: 'x' };`,
      importMeta: `return import.meta;`,
      yieldIdentifier: `const yield = 1; return 'x';`,
      emptyScript: `   `
    };

    Object.entries(cases).forEach(([name, code]) => {
      it(`should refuse ${name}`, () => {
        expectInvalid(code);
      });
    });

    it('should refuse every banned name as a member, a key, a pattern key and a binding', () => {
      OPENROUTER_TEMPLATE_BANNED_NAMES.forEach((name) => {
        expectInvalid(`return context.input.workerKey.${name};`);
        expectInvalid(`return context.input.workerKey['${name}'];`);
        expectInvalid(`return { '${name}': 'x' };`);
        expectInvalid(`const { ${name}: x } = context.input; return 'x';`);

        if (name !== 'arguments' && name !== 'eval') {
          expectInvalid(`const ${name} = 'x'; return 'x';`);
        }
      });
    });

    it('should refuse every excluded member', () => {
      OPENROUTER_TEMPLATE_EXCLUDED_MEMBER_NAMES.forEach((name) => {
        expectInvalid(`return context.input.workerKey.${name}('x');`);
      });
    });

    it('should refuse a script over the length limit', () => {
      expectInvalid(`return '${'a'.repeat(OPENROUTER_TEMPLATE_SCRIPT_MAX_LENGTH)}';`);
    });

    it('should refuse a script that nests too deep', () => {
      expectInvalid(`return ${'['.repeat(300)}${']'.repeat(300)};`);
    });

    it('should report a parse error with its position', () => {
      const result = validate(`return 'x'\nconst = 1;`);
      expect(result.valid).toBe(false);
      expect(result.errors[0].line).toBe(2);
    });

    it('should report a refused node with its 1-based position', () => {
      const result = validate(`const a = 1;\nreturn this;`);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].column).toBe(8);
    });
  });

  describe('modes and phases', () => {
    it('should refuse a body script for an OPENROUTER type', () => {
      expectInvalid(`return 'x';`, TEST_OPENROUTER_TEMPLATE_TYPE);
    });

    it('should refuse a final script for a DETERMINISTIC type', () => {
      expectInvalid(`return context.output.text;`, TEST_PROFILE_TEXT_TEMPLATE_TYPE, { phase: 'final' });
    });

    it('should refuse a final script for a type that does not allow one', () => {
      expectInvalid(`return context.output.text;`, { ...TEST_JOB_REMINDER_TEMPLATE_TYPE, finalScript: undefined }, { phase: 'final' });
    });

    it('should accept a final script that wraps the model text', () => {
      expectValid(`const worker = await context.loadWorker(); return \`Hi \${worker.firstName}! \${context.output.text.trim()}\`;`, TEST_JOB_REMINDER_TEMPLATE_TYPE, { phase: 'final' });
    });

    it('should accept a final script that formats declared json_schema fields', () => {
      const outputJsonSchema = { type: 'object', properties: { summary: { type: 'string' }, count: { type: 'number' } } };
      expectValid(`const json = context.output.json; return \`\${json.summary} (\${json.count})\`;`, TEST_JOB_REMINDER_TEMPLATE_TYPE, { phase: 'final', outputJsonSchema });
    });

    it('should refuse a final script reading an undeclared json_schema field', () => {
      const outputJsonSchema = { type: 'object', properties: { summary: { type: 'string' } } };
      expectInvalid(`return context.output.json.firstName;`, TEST_JOB_REMINDER_TEMPLATE_TYPE, { phase: 'final', outputJsonSchema });
    });

    it('should refuse a json_schema declaring a banned property name', () => {
      const outputJsonSchema = { type: 'object', properties: { constructor: { type: 'string' } } };
      expectInvalid(`return context.output.text;`, TEST_JOB_REMINDER_TEMPLATE_TYPE, { phase: 'final', outputJsonSchema });
    });

    it('should refuse a final script that returns OpenRouter details', () => {
      expectInvalid(`return { openRouter: { input: context.output.text } };`, TEST_JOB_REMINDER_TEMPLATE_TYPE, { phase: 'final' });
    });

    it('should refuse context.output in a body script', () => {
      expectInvalid(`return context.output.text;`);
    });

    it('should give an OPENROUTER final script only context.output', () => {
      expectValid(`return context.output.text.trim();`, TEST_OPENROUTER_TEMPLATE_TYPE, { phase: 'final' });
      expectInvalid(`return context.input.workerKey;`, TEST_OPENROUTER_TEMPLATE_TYPE, { phase: 'final' });
    });
  });
});
