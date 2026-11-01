import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { TEST_JOB_REMINDER_TEMPLATE_TYPE, TEST_OPENROUTER_TEMPLATE_TYPE, TEST_PROFILE_TEXT_TEMPLATE_TYPE } from '../test/openrouter.template.fixture';
import { OpenRouterTemplateMode, OpenRouterTemplateModeError, OpenRouterTemplateRenderError, readOpenRouterTemplateBodyResult } from './openrouter.template';
import { OpenRouterTemplateTypeConfigError, appOpenRouterTemplateTypeConfigService, openRouterTemplateFieldNames, openRouterTemplateType, openRouterTemplateTypeConfigRecord } from './openrouter.template.type';

describe('readOpenRouterTemplateBodyResult()', () => {
  const { DETERMINISTIC, DETERMINISTIC_OPENROUTER, DETERMINISTIC_OR_OPENROUTER, OPENROUTER } = OpenRouterTemplateMode;

  it('should read a string or { text } as text', () => {
    expect(readOpenRouterTemplateBodyResult('Hi', DETERMINISTIC)).toEqual({ kind: 'text', text: 'Hi' });
    expect(readOpenRouterTemplateBodyResult({ text: 'Hi' }, DETERMINISTIC_OR_OPENROUTER)).toEqual({ kind: 'text', text: 'Hi' });
  });

  it('should read null, empty and whitespace results as empty in every mode', () => {
    [null, undefined, '', '   ', { text: null }].forEach((x) => {
      expect(readOpenRouterTemplateBodyResult(x, DETERMINISTIC)).toEqual({ kind: 'empty' });
      expect(readOpenRouterTemplateBodyResult(x, DETERMINISTIC_OPENROUTER)).toEqual({ kind: 'empty' });
    });
  });

  it('should read OpenRouter details in the modes that call a model', () => {
    const result = { openRouter: { input: 'jobs' } };
    expect(readOpenRouterTemplateBodyResult(result, DETERMINISTIC_OPENROUTER)).toEqual({ kind: 'openrouter', openRouter: { input: 'jobs' } });
    expect(readOpenRouterTemplateBodyResult(result, DETERMINISTIC_OR_OPENROUTER)).toEqual({ kind: 'openrouter', openRouter: { input: 'jobs' } });
  });

  it('should refuse OpenRouter details under DETERMINISTIC', () => {
    expect(() => readOpenRouterTemplateBodyResult({ openRouter: { input: 'jobs' } }, DETERMINISTIC)).toThrow(OpenRouterTemplateModeError);
  });

  it('should refuse text under DETERMINISTIC_OPENROUTER', () => {
    expect(() => readOpenRouterTemplateBodyResult('Hi', DETERMINISTIC_OPENROUTER)).toThrow(OpenRouterTemplateModeError);
  });

  it('should refuse any body result under OPENROUTER', () => {
    expect(() => readOpenRouterTemplateBodyResult('Hi', OPENROUTER)).toThrow(OpenRouterTemplateModeError);
  });

  it('should let a final script return text or nothing, never details', () => {
    expect(readOpenRouterTemplateBodyResult('Hi', OPENROUTER, 'final')).toEqual({ kind: 'text', text: 'Hi' });
    expect(readOpenRouterTemplateBodyResult('Hi', DETERMINISTIC_OPENROUTER, 'final')).toEqual({ kind: 'text', text: 'Hi' });
    expect(readOpenRouterTemplateBodyResult(null, OPENROUTER, 'final')).toEqual({ kind: 'empty' });
    expect(() => readOpenRouterTemplateBodyResult({ openRouter: { input: 'x' } }, DETERMINISTIC_OR_OPENROUTER, 'final')).toThrow(OpenRouterTemplateModeError);
    expect(() => readOpenRouterTemplateBodyResult('Hi', DETERMINISTIC, 'final')).toThrow(OpenRouterTemplateModeError);
  });

  it('should refuse malformed results', () => {
    [42, ['Hi'], { text: 'a', openRouter: { input: 'b' } }, { text: 1 }, { other: 'x' }, { openRouter: { input: '' } }, { openRouter: { input: 'x', model: 'y' } }, { text: 'a', extra: 1 }].forEach((x) => {
      expect(() => readOpenRouterTemplateBodyResult(x, DETERMINISTIC_OR_OPENROUTER)).toThrow(OpenRouterTemplateRenderError);
    });
  });
});

describe('openRouterTemplateType()', () => {
  const base = {
    type: 'test',
    name: 'Test',
    purpose: 'Testing.',
    mode: OpenRouterTemplateMode.DETERMINISTIC,
    input: type({ key: 'string' }),
    output: { maxLength: 160 }
  };

  it('should return a valid config', () => {
    expect(openRouterTemplateType(base)).toBe(base);
  });

  it('should refuse a missing input on a mode with a body', () => {
    expect(() => openRouterTemplateType({ ...base, input: undefined })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse an input or loaders on an OPENROUTER type', () => {
    expect(() => openRouterTemplateType({ ...base, mode: OpenRouterTemplateMode.OPENROUTER })).toThrow(OpenRouterTemplateTypeConfigError);
    expect(() => openRouterTemplateType({ ...base, mode: OpenRouterTemplateMode.OPENROUTER, input: undefined, loaders: { loadX: { output: type({ a: 'string' }), load: async () => ({ a: 'x' }) } } })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse a final script setting on a DETERMINISTIC type', () => {
    expect(() => openRouterTemplateType({ ...base, finalScript: 'optional' })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse a loader name that does not match load[A-Z]', () => {
    expect(() => openRouterTemplateType({ ...base, loaders: { getProfile: { output: type({ a: 'string' }), load: async () => ({ a: 'x' }) } } })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse a banned field name anywhere in a shape', () => {
    expect(() => openRouterTemplateType({ ...base, input: type({ caller: 'string' }) })).toThrow(OpenRouterTemplateTypeConfigError);
    expect(() => openRouterTemplateType({ ...base, loaders: { loadX: { output: type({ items: type({ toString: 'string' }).array() }), load: async () => ({ items: [] }) } } })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse a shape that is not JSON-only', () => {
    expect(() => openRouterTemplateType({ ...base, input: type({ at: 'Date' }) })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse a non-positive maxLength', () => {
    expect(() => openRouterTemplateType({ ...base, output: { maxLength: 0 } })).toThrow(OpenRouterTemplateTypeConfigError);
  });
});

describe('openRouterTemplateFieldNames()', () => {
  it('should return the flat property names and the declared paths', () => {
    const { propertyNames, paths, loaderNames } = openRouterTemplateFieldNames(TEST_JOB_REMINDER_TEMPLATE_TYPE);

    expect([...loaderNames].sort()).toEqual(['loadJobs', 'loadWorker']);
    expect([...propertyNames].sort()).toEqual(['date', 'firstName', 'input', 'loadJobs', 'loadWorker', 'name', 'nickname', 'school', 'title', 'workerKey']);
    expect([...paths].sort()).toEqual(['input', 'input.workerKey', 'loadJobs', 'loadJobs[]', 'loadJobs[].date', 'loadJobs[].school', 'loadJobs[].school.name', 'loadJobs[].title', 'loadWorker', 'loadWorker.firstName', 'loadWorker.nickname']);
  });

  it('should return nothing for an OPENROUTER type', () => {
    const { propertyNames, paths } = openRouterTemplateFieldNames(TEST_OPENROUTER_TEMPLATE_TYPE);
    expect(propertyNames.size).toBe(0);
    expect(paths.size).toBe(0);
  });
});

describe('appOpenRouterTemplateTypeConfigService()', () => {
  const service = appOpenRouterTemplateTypeConfigService(openRouterTemplateTypeConfigRecord([TEST_JOB_REMINDER_TEMPLATE_TYPE, TEST_PROFILE_TEXT_TEMPLATE_TYPE]));

  it('should return a registered type', () => {
    expect(service.configForTemplateType('test-profile-text')).toBe(TEST_PROFILE_TEXT_TEMPLATE_TYPE);
    expect(service.getAllKnownTemplateTypes()).toEqual(['test-job-reminder', 'test-profile-text']);
  });

  it('should refuse an unknown type', () => {
    expect(service.registeredConfigForTemplateType('unknown')).toBeUndefined();
    expect(service.registeredConfigForTemplateType('constructor')).toBeUndefined();
    expect(() => service.configForTemplateType('unknown')).toThrow();
  });

  it('should refuse a duplicate type in a record', () => {
    expect(() => openRouterTemplateTypeConfigRecord([TEST_PROFILE_TEXT_TEMPLATE_TYPE, TEST_PROFILE_TEXT_TEMPLATE_TYPE])).toThrow();
  });
});
