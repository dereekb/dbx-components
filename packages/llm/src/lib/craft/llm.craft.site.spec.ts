import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_CRAFT_SITE_LIMITS, llmCraftAskInputsOf, llmCraftNoteUnknownWhereValues, llmCraftSiteFactShapeOf, makeLlmCraftSiteRegistry, type LlmCraftSite, type LlmCraftSiteFactValuesOf } from './llm.craft.site';

const SITES = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open', bundle: 'boolean' }, inputs: ['brief', 'notes'] },
    'support-reply': { facts: { channel: 'closed', tags: 'open' }, inputs: ['message'], limits: { maxBytes: 2400 } },
    'release-notes': { facts: { audience: 'closed' }, inputs: ['summary'] }
  }
});

function siteOf(kind: string): LlmCraftSite {
  const site = SITES.siteOf(kind);

  if (site == null) {
    throw new Error(`no site ${kind}`);
  }

  return site;
}

const VOCABULARIES: Readonly<Record<string, Readonly<Record<string, ReadonlyArray<string>>>>> = {
  'product-page': { category: ['apparel', 'shoes'] },
  'support-reply': { channel: ['email', 'chat'] },
  'release-notes': { audience: ['staff', 'customers'], category: ['apparel', 'bags'] }
};

const valuesOf: LlmCraftSiteFactValuesOf = (kind, fact) => VOCABULARIES[kind]?.[fact];

describe('makeLlmCraftSiteRegistry()', () => {
  it('lists the kinds in declaration order', () => {
    expect(SITES.kinds).toEqual(['product-page', 'support-reply', 'release-notes']);
  });

  it('resolves each limit per field: the site, else the registry, else the default', () => {
    const registry = makeLlmCraftSiteRegistry({
      sites: {
        a: { facts: {}, inputs: [], limits: { maxBytes: 2400, judgeMax: undefined } },
        b: { facts: {}, inputs: [] }
      },
      limits: { maxNotes: 2, judgeInputMax: undefined }
    });

    expect(registry.siteOf('a')?.limits).toEqual({ maxNotes: 2, maxBytes: 2400, judgeMax: DEFAULT_LLM_CRAFT_SITE_LIMITS.judgeMax, judgeInputMax: DEFAULT_LLM_CRAFT_SITE_LIMITS.judgeInputMax });
    expect(registry.siteOf('b')?.limits).toEqual({ ...DEFAULT_LLM_CRAFT_SITE_LIMITS, maxNotes: 2 });
    expect(siteOf('product-page').limits).toEqual({ maxNotes: 4, maxBytes: 3000, judgeMax: 8, judgeInputMax: 600 });
    expect(siteOf('support-reply').limits.maxBytes).toBe(2400);
  });

  it('answers no site for an unknown kind, a prototype key, null or undefined', () => {
    expect(SITES.siteOf('poster')).toBeUndefined();
    expect(SITES.siteOf('toString')).toBeUndefined();
    expect(SITES.siteOf(null)).toBeUndefined();
    expect(SITES.siteOf(undefined)).toBeUndefined();
  });

  it('defaults noteMaxBytes to 1500 and takes an override', () => {
    expect(SITES.noteMaxBytes).toBe(1500);
    expect(makeLlmCraftSiteRegistry({ sites: {}, noteMaxBytes: 800 }).noteMaxBytes).toBe(800);
  });

  it('throws on an input name no ask could name, naming the kind', () => {
    expect(() => makeLlmCraftSiteRegistry({ sites: { 'product-page': { facts: {}, inputs: ['Brief'] } } })).toThrow(/product-page.*Brief/);
    expect(() => makeLlmCraftSiteRegistry({ sites: { 'support-reply': { facts: {}, inputs: ['free text'] } } })).toThrow(/support-reply.*free text/);
  });
});

describe('llmCraftSiteFactShapeOf()', () => {
  it('reads a fact shape, and nothing for an unknown or prototype key', () => {
    const page = siteOf('product-page');
    expect(llmCraftSiteFactShapeOf(page, 'category')).toBe('closed');
    expect(llmCraftSiteFactShapeOf(page, 'brand')).toBe('open');
    expect(llmCraftSiteFactShapeOf(page, 'bundle')).toBe('boolean');
    expect(llmCraftSiteFactShapeOf(page, 'channel')).toBeUndefined();
    expect(llmCraftSiteFactShapeOf(page, 'toString')).toBeUndefined();
  });
});

describe('llmCraftAskInputsOf()', () => {
  it('reads the inputs an ask names: backticked, of the given sites, first mention once', () => {
    expect(llmCraftAskInputsOf('`brief` and `notes` again `brief`, not `message`', [siteOf('product-page')])).toEqual(['brief', 'notes']);
    expect(llmCraftAskInputsOf('`summary` is set', [siteOf('support-reply'), siteOf('release-notes')])).toEqual(['summary']);
    expect(llmCraftAskInputsOf('brief, unquoted', [siteOf('product-page')])).toEqual([]);
  });
});

describe('llmCraftNoteUnknownWhereValues()', () => {
  it('names a value no site vocabulary holds, in where order, with the union of the vocabularies', () => {
    const unknown = llmCraftNoteUnknownWhereValues({ note: { sites: ['product-page', 'release-notes'], where: { category: ['apparel', 'hats', 'wallets'] } }, valuesOf });
    expect(unknown).toEqual([
      { fact: 'category', value: 'hats', values: ['apparel', 'shoes', 'bags'] },
      { fact: 'category', value: 'wallets', values: ['apparel', 'shoes', 'bags'] }
    ]);
  });

  it('never checks an open or boolean fact', () => {
    expect(llmCraftNoteUnknownWhereValues({ note: { sites: ['product-page'], where: { brand: ['anything'], bundle: [true] } }, valuesOf })).toEqual([]);
  });

  it('reads the one vocabulary of a fact closed at one site and absent at another', () => {
    expect(llmCraftNoteUnknownWhereValues({ note: { sites: ['support-reply', 'release-notes'], where: { audience: ['partners'] } }, valuesOf })).toEqual([{ fact: 'audience', value: 'partners', values: ['staff', 'customers'] }]);
  });

  it('answers nothing when every value is known', () => {
    expect(llmCraftNoteUnknownWhereValues({ note: { sites: ['product-page'], where: { category: ['apparel', 'shoes'] } }, valuesOf })).toEqual([]);
  });
});
