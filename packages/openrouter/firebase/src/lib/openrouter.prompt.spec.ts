import { describe, expect, it } from 'vitest';
import { OPENROUTER_PROMPT_VERSION_ID_DIGITS, openRouterPromptVersionId, openRouterPromptVersionNumberFromId } from './openrouter.prompt.id';
import { OpenRouterPromptState, openRouterPromptConverter, openRouterPromptIdentity, openRouterPromptVersionConverter, openRouterPromptVersionIdentity, openRouterResolvedPromptForVersion } from './openrouter.prompt';

describe('openRouterPromptVersionId()', () => {
  it('should zero-pad so lexical document ordering matches numeric ordering', () => {
    // Unpadded, '10' sorts before '2'.
    expect(openRouterPromptVersionId(1)).toBe('000001');
    expect(openRouterPromptVersionId(2) < openRouterPromptVersionId(10)).toBe(true);
    expect(openRouterPromptVersionId(1).length).toBe(OPENROUTER_PROMPT_VERSION_ID_DIGITS);
  });

  it('should round-trip back to the version number', () => {
    expect(openRouterPromptVersionNumberFromId(openRouterPromptVersionId(42))).toBe(42);
  });
});

describe('openRouterPromptIdentity', () => {
  it('should use the documented collection name and short code', () => {
    // The SHORT code is the persisted collection path; `modelType` carries the long, readable name.
    expect(openRouterPromptIdentity.collectionName).toBe('orp');
    expect(openRouterPromptIdentity.modelType).toBe('openRouterPrompt');
  });

  it('should declare the version subcollection under the prompt', () => {
    expect(openRouterPromptVersionIdentity.collectionName).toBe('orpv');
    expect(openRouterPromptVersionIdentity.modelType).toBe('openRouterPromptVersion');
    // The nested collectionType is what proves the parentage.
    expect(openRouterPromptVersionIdentity.collectionType).toBe('orp/orpv');
  });
});

describe('openRouterPromptConverter', () => {
  it('should round-trip a prompt', () => {
    const cat = new Date();
    const data = openRouterPromptConverter.mapFunctions.to({ cat, n: 'Name', d: 'desc', s: OpenRouterPromptState.ACTIVE, av: 2, lv: 3, t: ['a'] });
    const back = openRouterPromptConverter.mapFunctions.from(data);

    expect(back.n).toBe('Name');
    expect(back.s).toBe(OpenRouterPromptState.ACTIVE);
    expect(back.av).toBe(2);
    expect(back.lv).toBe(3);
    expect(back.t).toEqual(['a']);
  });

  it('should default a missing state to DRAFT so an unfinished prompt is never servable', () => {
    expect(openRouterPromptConverter.mapFunctions.from({}).s).toBe(OpenRouterPromptState.DRAFT);
  });
});

describe('openRouterPromptVersionConverter', () => {
  it('should store an arbitrary config unchanged, including unknown parameters', () => {
    // Passthrough, deliberately: a strict converter would silently drop fields on every OpenRouter release.
    const config = { model: 'openai/gpt-5.1', plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }], someFutureParam: { nested: [1, 2] } };
    const data = openRouterPromptVersionConverter.mapFunctions.to({ cat: new Date(), v: 1, c: config });
    const back = openRouterPromptVersionConverter.mapFunctions.from(data);

    expect(back.c).toEqual(config);
  });

  it('should round-trip seed messages in short-key form', () => {
    const data = openRouterPromptVersionConverter.mapFunctions.to({ cat: new Date(), v: 1, m: [{ r: 'system', c: 'hello' }] });
    expect(openRouterPromptVersionConverter.mapFunctions.from(data).m).toEqual([{ r: 'system', c: 'hello' }]);
  });

  it('should not store an empty messages array', () => {
    const data = openRouterPromptVersionConverter.mapFunctions.to({ cat: new Date(), v: 1, m: [] });
    expect(data.m).toBeNull();
  });
});

describe('openRouterResolvedPromptForVersion()', () => {
  it('should expand short-key messages into the request-builder shape', () => {
    const resolved = openRouterResolvedPromptForVersion('kaia-resume-parser', { cat: new Date(), v: 4, i: 'sys', m: [{ r: 'user', c: 'seed' }], c: { model: 'm' } });

    expect(resolved.promptKey).toBe('kaia-resume-parser');
    expect(resolved.version).toBe(4);
    expect(resolved.instructions).toBe('sys');
    expect(resolved.messages).toEqual([{ role: 'user', content: 'seed' }]);
    expect(resolved.config).toEqual({ model: 'm' });
  });

  it('should default a missing config to an empty object', () => {
    expect(openRouterResolvedPromptForVersion('p', { cat: new Date(), v: 1 }).config).toEqual({});
  });
});
