import { describe, expect, it } from 'vitest';
import { TEST_JOB_REMINDER_TEMPLATE_TYPE, TEST_PROFILE_TEXT_TEMPLATE_TYPE } from '../test/openrouter.template.fixture';
import { OpenRouterTemplateMode, OpenRouterTemplateModeError, OpenRouterTemplateRenderError, readOpenRouterTemplateBodyResult } from './openrouter.template';
import { openRouterTemplateContextFactory } from './openrouter.template.context';
import { OpenRouterTemplateTypeConfigError, appOpenRouterTemplateTypeConfigService, openRouterTemplateType, openRouterTemplateTypeConfigRecord } from './openrouter.template.type';

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
  const contextFactory = openRouterTemplateContextFactory({
    accessors: { profile: async () => ({ username: 'ana' }) }
  });

  const base = {
    type: 'test',
    name: 'Test',
    purpose: 'Testing.',
    mode: OpenRouterTemplateMode.DETERMINISTIC,
    contextFactory,
    output: { maxLength: 160 }
  };

  it('should return a valid config', () => {
    expect(openRouterTemplateType(base)).toBe(base);
    expect(openRouterTemplateType(TEST_JOB_REMINDER_TEMPLATE_TYPE)).toBe(TEST_JOB_REMINDER_TEMPLATE_TYPE);
  });

  it('should accept a type with a body and no context factory', () => {
    expect(() => openRouterTemplateType({ ...base, contextFactory: undefined })).not.toThrow();
  });

  it('should refuse a context factory on an OPENROUTER type', () => {
    expect(() => openRouterTemplateType({ ...base, mode: OpenRouterTemplateMode.OPENROUTER })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse a final script setting on a DETERMINISTIC type', () => {
    expect(() => openRouterTemplateType({ ...base, finalScript: 'optional' })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse sample data for an accessor the context factory does not have', () => {
    expect(() => openRouterTemplateType({ ...base, samples: { accessor: { profile: { username: 'ana' } } } })).not.toThrow();
    expect(() => openRouterTemplateType({ ...base, samples: { accessor: { worker: { firstName: 'Ana' } } as never } })).toThrow(OpenRouterTemplateTypeConfigError);
    expect(() => openRouterTemplateType({ ...base, contextFactory: undefined, samples: { accessor: { profile: { username: 'ana' } } } })).toThrow(OpenRouterTemplateTypeConfigError);
  });

  it('should refuse a non-positive maxLength', () => {
    expect(() => openRouterTemplateType({ ...base, output: { maxLength: 0 } })).toThrow(OpenRouterTemplateTypeConfigError);
  });
});

describe('openRouterTemplateContextFactory()', () => {
  it('should expose the accessor names and the accessors', () => {
    const profile = async () => ({ username: 'ana' });
    const factory = openRouterTemplateContextFactory({ accessors: { profile } });

    expect([...factory.accessorNames]).toEqual(['profile']);
    expect(factory.accessors.profile).toBe(profile);
    expect([...TEST_JOB_REMINDER_TEMPLATE_TYPE.contextFactory!.accessorNames].sort()).toEqual(['jobs', 'worker']);
  });

  it('should refuse an accessor name that is not plain camelCase or is banned', () => {
    ['Profile', '_x', 'load-profile', 'then', 'constructor'].forEach((name) => {
      expect(() => openRouterTemplateContextFactory({ accessors: { [name]: async () => 'x' } })).toThrow(OpenRouterTemplateTypeConfigError);
    });
  });

  it('should refuse an accessor that is not a function', () => {
    expect(() => openRouterTemplateContextFactory({ accessors: { profile: 'x' } as never })).toThrow(OpenRouterTemplateTypeConfigError);
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
