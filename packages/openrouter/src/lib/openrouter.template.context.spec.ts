import { describe, expect, it, vi } from 'vitest';
import { TEST_GOOD_TEMPLATE_SCRIPTS, TEST_JOB_REMINDER_TEMPLATE_TYPE, TEST_OPENROUTER_TEMPLATE_TYPE, TEST_PROFILE_TEXT_TEMPLATE_TYPE } from '../test/openrouter.template.fixture';
import { OpenRouterTemplateMode, OpenRouterTemplateRenderError, readOpenRouterTemplateBodyResult } from './openrouter.template';
import { copyOpenRouterTemplateJsonOutput, copyOpenRouterTemplatePlainData, openRouterTemplateContext, openRouterTemplateContextFactory, openRouterTemplateFinalContext } from './openrouter.template.context';
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
  const notification = { key: 'nb/1/n/1', templateType: 'ORTT', createdAt: '2026-11-03T15:00:00.000Z' };

  describe('data', () => {
    it('should copy and freeze the data without checking its shape, dropping banned keys', () => {
      const factory = openRouterTemplateContextFactory({});
      const raw = JSON.parse('{"a":"x","extra":{"b":1},"constructor":"y"}') as object;
      const context = factory({ data: raw });
      expect(context.data).toEqual({ a: 'x', extra: { b: 1 } });
      expect(context.data).not.toBe(raw);
      expect(Object.isFrozen((context.data as { extra: object }).extra)).toBe(true);
      expect(() => factory({ data: { at: new Date() } })).toThrow(OpenRouterTemplateRenderError);
      expect(() => openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: new TestTimestamp(1) } })).toThrow(OpenRouterTemplateRenderError);
    });

    it('should turn undefined data into null', () => {
      expect(openRouterTemplateContextFactory({})({ data: undefined }).data).toBeNull();
    });
  });

  describe('structure', () => {
    it('should be a frozen, null-prototype object with exactly data, notification and accessor', () => {
      const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } });
      expect(Object.getPrototypeOf(context)).toBeNull();
      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.keys(context)).toEqual(['data', 'notification', 'accessor']);
    });

    it('should hold the accessors in a frozen, null-prototype object', () => {
      const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } });
      expect(Object.getPrototypeOf(context.accessor)).toBeNull();
      expect(Object.isFrozen(context.accessor)).toBe(true);
      expect(Object.keys(context.accessor).sort()).toEqual(['jobs', 'worker']);
    });

    it('should use a factory with no accessors for a type without one', () => {
      const typeConfig = openRouterTemplateType({ ...TEST_PROFILE_TEXT_TEMPLATE_TYPE, contextFactory: undefined });
      const context = openRouterTemplateContext({ typeConfig, data: { anything: 1 } });
      expect(context.data).toEqual({ anything: 1 });
      expect(Object.keys(context.accessor)).toEqual([]);
    });
  });

  describe('notification', () => {
    it('should be null when the render is not for a notification', () => {
      expect(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } }).notification).toBeNull();
    });

    it('should validate, strip and freeze the notification', () => {
      const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' }, notification: { ...notification, recipients: ['u1'] } as never });
      expect(context.notification).toEqual(notification);
      expect(Object.isFrozen(context.notification)).toBe(true);
    });

    it('should refuse an invalid notification', () => {
      expect(() => openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' }, notification: { ...notification, createdAt: 1 } as never })).toThrow(OpenRouterTemplateRenderError);
    });
  });

  describe('accessors', () => {
    it('should memoize each accessor per context and call it once with the frozen source', async () => {
      const profile = vi.fn(async () => ({ username: 'ana' }));
      const factory = openRouterTemplateContextFactory({ accessors: { profile } });
      const context = factory({ data: { profileKey: 'p/1' }, notification });

      const [a, b] = await Promise.all([context.accessor.profile(), context.accessor.profile()]);
      expect(a).toEqual({ username: 'ana' });
      expect(a).toBe(b);
      expect(Object.isFrozen(a)).toBe(true);
      expect(profile).toHaveBeenCalledTimes(1);

      const [source] = profile.mock.calls[0] as unknown as [object];
      expect(source).toEqual({ data: { profileKey: 'p/1' }, notification });
      expect(Object.isFrozen(source)).toBe(true);
    });

    it('should freeze an accessor result without stripping it', async () => {
      const factory = openRouterTemplateContextFactory({ accessors: { profile: async () => ({ username: 'ana', bio: 'Teacher', extra: { a: 1 } }) } });
      const result = await factory({ data: null }).accessor.profile();
      expect(result).toEqual({ username: 'ana', bio: 'Teacher', extra: { a: 1 } });
      expect(Object.isFrozen(result.extra)).toBe(true);
    });

    it('should refuse an accessor result that is not plain data', async () => {
      const results: unknown[] = [{ at: new Date() }, new TestTimestamp(1), { fn: () => 1 }];

      for (const x of results) {
        const factory = openRouterTemplateContextFactory({ accessors: { profile: async () => x as never } });
        await expect(factory({ data: null }).accessor.profile()).rejects.toThrow(OpenRouterTemplateRenderError);
      }
    });

    it('should turn an undefined result into null', async () => {
      const factory = openRouterTemplateContextFactory({ accessors: { profile: async (): Promise<{ username: string } | undefined> => undefined } });
      expect(await factory({ data: null }).accessor.profile()).toBeNull();
    });

    it('should use an accessor override instead of the real accessor, and copy and freeze it', async () => {
      const worker = vi.fn(async () => ({ firstName: 'Real' }));
      const jobs = vi.fn(async () => [{ title: 'Real job' }]);
      const factory = openRouterTemplateContextFactory({ accessors: { worker, jobs } });
      const override = { firstName: 'Sample' };
      const context = factory({ data: null, accessorOverrides: { worker: override } });

      const result = await context.accessor.worker();
      expect(result).toEqual({ firstName: 'Sample' });
      expect(result).not.toBe(override);
      expect(Object.isFrozen(result)).toBe(true);
      expect(worker).not.toHaveBeenCalled();
      expect(await context.accessor.jobs()).toEqual([{ title: 'Real job' }]);
      expect(jobs).toHaveBeenCalledTimes(1);
    });

    it('should look up the accessor when it is called, so a spy on the factory intercepts it', async () => {
      const factory = openRouterTemplateContextFactory({ accessors: { profile: async () => ({ username: 'real' }) } });
      const spy = vi.spyOn(factory.accessors, 'profile').mockResolvedValue({ username: 'spied' });
      expect(await factory({ data: null }).accessor.profile()).toEqual({ username: 'spied' });
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('openRouterTemplateFinalContext()', () => {
  it('should carry the body context and a frozen output', () => {
    const body = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } });
    const context = openRouterTemplateFinalContext(body, { text: 'Hi' });
    expect(context.data).toBe(body.data);
    expect(context.notification).toBe(body.notification);
    expect(context.accessor).toBe(body.accessor);
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
    const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } });
    const result = readOpenRouterTemplateBodyResult(await script(context), OpenRouterTemplateMode.DETERMINISTIC_OR_OPENROUTER);
    expect(result).toEqual({ kind: 'text', text: 'Hi Ana, your upcoming jobs:\n- Grade 3 teacher on Mon, Nov 3\n- Library aide on Tue, Nov 4' });
  });

  it('should return details or text depending on the data', async () => {
    const script = compileOpenRouterTemplateScript({ code: TEST_GOOD_TEMPLATE_SCRIPTS['detailsOrText'], typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    const manyJobs = Array.from({ length: 6 }, (_, i) => ({ title: `Job ${i}`, date: 'Mon' }));
    const few = await script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } }));
    const many = await script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' }, accessorOverrides: { jobs: manyJobs } }));
    expect(few).toEqual({ text: 'Grade 3 teacher, Library aide' });
    expect(readOpenRouterTemplateBodyResult(many, OpenRouterTemplateMode.DETERMINISTIC_OR_OPENROUTER).kind).toBe('openrouter');
  });

  it('should return null when there are no jobs', async () => {
    const script = compileOpenRouterTemplateScript({ code: TEST_GOOD_TEMPLATE_SCRIPTS['noJobsNull'], typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    expect(await script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' }, accessorOverrides: { jobs: [] } }))).toBeNull();
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

  it('should re-validate against the current type config: a script calling an accessor the type no longer has fails to compile', () => {
    const code = `const worker = await context.accessor.worker(); return worker.firstName;`;
    expect(() => compileOpenRouterTemplateScript({ code, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE })).not.toThrow();
    const changed = openRouterTemplateType({ ...TEST_JOB_REMINDER_TEMPLATE_TYPE, contextFactory: openRouterTemplateContextFactory({ accessors: { jobs: async () => [] as { title: string }[] } }), samples: undefined });
    expect(() => compileOpenRouterTemplateScript({ code, typeConfig: changed })).toThrow(OpenRouterTemplateScriptValidationError);
  });

  it('should sanitize a runtime error', async () => {
    const script = compileOpenRouterTemplateScript({ code: `return context.data.workerKey.toFixed(2);`, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    const promise = script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } }));
    await expect(promise).rejects.toThrow(OpenRouterTemplateRenderError);
    await expect(promise).rejects.toThrow(/TypeError/);
  });

  it('should throw when a built-in method read off data is used as a replace callback, since it runs with no this', async () => {
    for (const method of ['repeat', 'padStart']) {
      const script = compileOpenRouterTemplateScript({ code: `return 'x'.replace('x', context.data.workerKey.${method});`, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
      await expect(script(openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } }))).rejects.toThrow(OpenRouterTemplateRenderError);
    }
  });

  it('should not let a script mutate its context', async () => {
    const script = compileOpenRouterTemplateScript({ code: `const jobs = await context.accessor.jobs(); return String(jobs.concat([1]).length);`, typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE });
    const context = openRouterTemplateContext({ typeConfig: TEST_JOB_REMINDER_TEMPLATE_TYPE, data: { workerKey: 'wk/1' } });
    expect(await script(context)).toBe('3');
    expect(await context.accessor.jobs()).toHaveLength(2);
  });
});
