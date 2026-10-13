import { describe, expect, it } from 'vitest';
import { type } from 'arktype';
import { queryOpenRouterPromptsParamsType, updateOpenRouterPromptParamsType } from './openrouter.api';
import { OpenRouterPromptState } from './openrouter.model';

describe('queryOpenRouterPromptsParamsType', () => {
  it('should fail on a state name', () => {
    const result = queryOpenRouterPromptsParamsType({ state: 'ACTIVE' });
    expect(result instanceof type.errors).toBe(true);
  });

  it('should fail on a number outside the enum', () => {
    const result = queryOpenRouterPromptsParamsType({ state: 7 });
    expect(result instanceof type.errors).toBe(true);
  });

  it('should pass a state value', () => {
    const result = queryOpenRouterPromptsParamsType({ state: OpenRouterPromptState.ACTIVE });
    expect(result).toEqual({ state: OpenRouterPromptState.ACTIVE });
  });

  it('should pass a null state', () => {
    const result = queryOpenRouterPromptsParamsType({ state: null });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass an omitted state', () => {
    const result = queryOpenRouterPromptsParamsType({});
    expect(result instanceof type.errors).toBe(false);
  });
});

describe('updateOpenRouterPromptParamsType', () => {
  it('should fail on a number outside the enum', () => {
    const result = updateOpenRouterPromptParamsType({ key: 'orp/a', state: 7 });
    expect(result instanceof type.errors).toBe(true);
  });

  it('should pass a state value', () => {
    const result = updateOpenRouterPromptParamsType({ key: 'orp/a', state: OpenRouterPromptState.ARCHIVED });
    expect(result instanceof type.errors).toBe(false);
  });
});
