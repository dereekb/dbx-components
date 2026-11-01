import { type } from 'arktype';
import { describe, expect, it, vi } from 'vitest';
import { TEST_GOOD_TEMPLATE_SCRIPTS, TEST_JOB_REMINDER_TEMPLATE_TYPE, TEST_OPENROUTER_TEMPLATE_TYPE, TEST_PROFILE_TEXT_TEMPLATE_TYPE } from '../test/openrouter.template.fixture';
import { OpenRouterTemplateMode, OpenRouterTemplateRenderError, readOpenRouterTemplateBodyResult } from './openrouter.template';
import { copyOpenRouterTemplateJsonOutput, copyOpenRouterTemplatePlainData, openRouterTemplateContext, openRouterTemplateFinalContext } from './openrouter.template.context';
import { OpenRouterTemplateScriptValidationError, compileOpenRouterTemplateScript } from './openrouter.template.script.run';
import { openRouterTemplateType } from './openrouter.template.type';

class TestTimestamp {
  constructor(readonly seconds: number) {}
}

describe('copyOpenRouterTemplatePlainData()', () => {
  it('should deep-copy plain data', () => {
    const value = { a: 'x', b: [1, true, null], c: { d: 'y' } };
    const copy = copyOpenRouterTemplatePlainData(value, 'Data') as typeof value;
    expect(copy).toEqual(value);
    expect(copy).not.toBe(value);
    expect(copy.c).not.toBe(value.c);
  });

  it('should drop undefined values and banned keys', () => {
    const value = JSON.parse('{"a":"x","__proto__":{"polluted":true},"constructor":"y"}') as object;
    expect(copyOpenRouterTemplatePlainData({ ...value, b: undefined }, 'Data')).toEqual({ a: 'x' });
  });

  it('should refuse anything that is not plain data', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    [new Date(), new TestTimestamp(1), () => 1, { a: () => 1 }, { a: new Map() }, Number.NaN, Infinity, 10n, Symbol('x'), cyclic, [undefined], Object.defineProperty({}, 'a', { get: () => 1, enumerable: true })].forEach((x) => {
      expect(() => copyOpenRouterTemplatePlainData(x, 'Data')).toThrow(OpenRouterTemplateRenderError);
    });
  });
});

describe('openRouterTemplateContext()', () => {
  it('should validate and strip the input', () => {
    const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1', extra: 'secret' } });
    expect(context.input).toEqual({ workerKey: 'wk/1' });
    expect(Object.isFrozen(context.input)).toBe(true);
  });

  it('should refuse an invalid input', () => {
    expect(() => openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 1 } })).toThrow(OpenRouterTemplateRenderError);
    expect(() => openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: new TestTimestamp(1) } })).toThrow(OpenRouterTemplateRenderError);
  });

  it('should be a frozen, null-prototype object', () => {
    const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1' } });
    expect(Object.getPrototypeOf(context)).toBeNull();
    expect(Object.isFrozen(context)).toBe(true);
  });

  it('should memoize each loader per context, and strip and freeze its output', async () => {
    const load = vi.fn(async () => ({ username: 'ana', password: 'secret' }));
    const typeConfig = openRouterTemplateType({ ...TEST_PROFILE_TEXT_TEMPLATE_TYPE, loaders: { loadProfile: { output: type({ username: 'string' }), load } } });
    const context = openRouterTemplateContext({ typeConfig, input: { profileKey: 'p/1' } });

    const [a, b] = await Promise.all([context.loadProfile(), context.loadProfile()]);
    expect(a).toEqual({ username: 'ana' });
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ profileKey: 'p/1' });
  });

  it('should refuse a loader output that is not plain data', async () => {
    const typeConfig = openRouterTemplateType({ ...TEST_PROFILE_TEXT_TEMPLATE_TYPE, loaders: { loadProfile: { output: type({ username: 'string' }), load: async () => ({ username: 'ana', ref: new TestTimestamp(1) }) as never } } });
    const context = openRouterTemplateContext({ typeConfig, input: { profileKey: 'p/1' } });
    await expect(context.loadProfile()).rejects.toThrow(OpenRouterTemplateRenderError);
  });

  it('should refuse a loader output that does not match its shape', async () => {
    const typeConfig = openRouterTemplateType({ ...TEST_PROFILE_TEXT_TEMPLATE_TYPE, loaders: { loadProfile: { output: type({ username: 'string' }), load: async () => ({ username: 3 }) as never } } });
    const context = openRouterTemplateContext({ typeConfig, input: { profileKey: 'p/1' } });
    await expect(context.loadProfile()).rejects.toThrow(OpenRouterTemplateRenderError);
  });

  it('should use a loader override instead of the real loader', async () => {
    const load = vi.fn(async () => ({ username: 'real' }));
    const typeConfig = openRouterTemplateType({ ...TEST_PROFILE_TEXT_TEMPLATE_TYPE, loaders: { loadProfile: { output: type({ username: 'string' }), load } } });
    const context = openRouterTemplateContext({ typeConfig, input: { profileKey: 'p/1' }, loaderOverrides: { loadProfile: { username: 'sample' } } });
    expect(await context.loadProfile()).toEqual({ username: 'sample' });
    expect(load).not.toHaveBeenCalled();
  });
});

describe('openRouterTemplateFinalContext()', () => {
  it('should carry the body context and a frozen output', () => {
    const body = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1' } });
    const context = openRouterTemplateFinalContext(body, { text: 'Hi' });
    expect(context.input).toBe(body.input);
    expect(context.loadJobs).toBe(body.loadJobs);
    expect(context.output.text).toBe('Hi');
    expect(Object.isFrozen(context.output)).toBe(true);
    expect(Object.getPrototypeOf(context)).toBeNull();
  });

  it('should carry only the output in OPENROUTER mode', () => {
    const context = openRouterTemplateFinalContext(undefined, { text: 'Hi', json: { a: 1 } });
    expect(Object.keys(context)).toEqual(['output']);
  });
});

describe('copyOpenRouterTemplateJsonOutput()', () => {
  const schema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      count: { type: 'integer' },
      jobs: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' } } } },
      note: { anyOf: [{ type: 'string' }, { type: 'null' }] }
    }
  };

  it('should keep only declared keys of the declared type', () => {
    const json = { summary: 'Two jobs', count: 2, secret: 'x', jobs: [{ title: 'A', pay: 100 }, 'bad'], note: null, constructor: 'y' };
    expect(copyOpenRouterTemplateJsonOutput(json, schema)).toEqual({ summary: 'Two jobs', count: 2, jobs: [{ title: 'A' }], note: null });
  });

  it('should drop values of the wrong type', () => {
    expect(copyOpenRouterTemplateJsonOutput({ summary: 3, count: 1.5, note: 4 }, schema)).toEqual({});
    expect(copyOpenRouterTemplateJsonOutput('text', schema)).toBeUndefined();
  });

  it('should return a frozen copy', () => {
    const copy = copyOpenRouterTemplateJsonOutput({ summary: 'x', jobs: [{ title: 'A' }] }, schema) as { jobs: object[] };
    expect(Object.isFrozen(copy)).toBe(true);
    expect(Object.isFrozen(copy.jobs[0])).toBe(true);
  });
});

describe('compileOpenRouterTemplateScript()', () => {
  it('should run a validated script against a context', async () => {
    const script = compileOpenRouterTemplateScript({ code: TEST_GOOD_TEMPLATE_SCRIPTS['jobReminder'], typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1' } });
    const result = readOpenRouterTemplateBodyResult(await script(context), OpenRouterTemplateMode.DETERMINISTIC_OR_OPENROUTER);
    expect(result).toEqual({ kind: 'text', text: 'Hi Ana, your upcoming jobs:\n- Grade 3 teacher on Mon, Nov 3\n- Library aide on Tue, Nov 4' });
  });

  it('should return details or text depending on the data', async () => {
    const script = compileOpenRouterTemplateScript({ code: TEST_GOOD_TEMPLATE_SCRIPTS['detailsOrText'], typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    const manyJobs = Array.from({ length: 6 }, (_, i) => ({ title: `Job ${i}`, date: 'Mon' }));
    const few = await script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1' } }));
    const many = await script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1' }, loaderOverrides: { loadJobs: manyJobs } }));
    expect(few).toEqual({ text: 'Grade 3 teacher, Library aide' });
    expect(readOpenRouterTemplateBodyResult(many, OpenRouterTemplateMode.DETERMINISTIC_OR_OPENROUTER).kind).toBe('openrouter');
  });

  it('should return null when there are no jobs', async () => {
    const script = compileOpenRouterTemplateScript({ code: TEST_GOOD_TEMPLATE_SCRIPTS['noJobsNull'], typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    expect(await script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1' }, loaderOverrides: { loadJobs: [] } }))).toBeNull();
  });

  it('should run a final script against the model output', async () => {
    const script = compileOpenRouterTemplateScript({ code: `return \`Update: \${context.output.text.trim()}\`;`, typeConfig: TEST_OPENROUTER_TEMPLATE_TYPE, phase: 'final' });
    expect(await script(openRouterTemplateFinalContext(undefined, { text: ' Schools close early. ' }))).toBe('Update: Schools close early.');
  });

  it('should cache compiled scripts', () => {
    const a = compileOpenRouterTemplateScript({ code: TEST_GOOD_TEMPLATE_SCRIPTS['pluralization'], typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    const b = compileOpenRouterTemplateScript({ code: TEST_GOOD_TEMPLATE_SCRIPTS['pluralization'], typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    expect(a).toBe(b);
  });

  it('should refuse an invalid script', () => {
    expect(() => compileOpenRouterTemplateScript({ code: `return this;`, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE })).toThrow(OpenRouterTemplateScriptValidationError);
  });

  it('should refuse a script that only fails in strict mode', () => {
    expect(() => compileOpenRouterTemplateScript({ code: `return String(010);`, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE })).toThrow(OpenRouterTemplateScriptValidationError);
  });

  it('should re-validate against the current type config', () => {
    const code = `return context.input.workerKey;`;
    expect(() => compileOpenRouterTemplateScript({ code, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE })).not.toThrow();
    const changed = openRouterTemplateType({ ...TEST_JOB_REMINDER_TEMPLATE_TYPE, input: type({ otherKey: 'string' }), samples: undefined });
    expect(() => compileOpenRouterTemplateScript({ code, typeConfig: changed })).toThrow(OpenRouterTemplateScriptValidationError);
  });

  it('should sanitize a runtime error', async () => {
    const script = compileOpenRouterTemplateScript({ code: `return context.input.workerKey.toFixed(2);`, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    const promise = script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1' } }));
    await expect(promise).rejects.toThrow(OpenRouterTemplateRenderError);
    await expect(promise).rejects.toThrow(/TypeError/);
  });

  it('should not let a script mutate its context', async () => {
    const script = compileOpenRouterTemplateScript({ code: `const jobs = await context.loadJobs(); return String(jobs.concat([1]).length);`, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, input: { workerKey: 'wk/1' } });
    expect(await script(context)).toBe('3');
    expect(await context.loadJobs()).toHaveLength(2);
  });
});
