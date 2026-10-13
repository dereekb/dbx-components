import { buildRankedSearchEntries, rankSearchEntries, RANKED_SEARCH_NAME_WEIGHTS, RANKED_SEARCH_TEXT_WEIGHTS, splitSearchIdentifierWords, tokenizeSearchQuery } from './search.ranked';

describe('splitSearchIdentifierWords()', () => {
  it('should split dots, dashes, and camelCase', () => {
    expect(splitSearchIdentifierWords('jobWorkerTimesheet.update.reopen')).toEqual(['job', 'worker', 'timesheet', 'update', 'reopen']);
    expect(splitSearchIdentifierWords('model-get')).toEqual(['model', 'get']);
  });

  it('should split acronym boundaries', () => {
    expect(splitSearchIdentifierWords('HTTPServer_v2')).toEqual(['http', 'server', 'v2']);
  });
});

describe('tokenizeSearchQuery()', () => {
  it('should return unique lowercase tokens', () => {
    expect(tokenizeSearchQuery('Reopen  timesheet reopen')).toEqual(['reopen', 'timesheet']);
  });

  it('should return no tokens for an empty query', () => {
    expect(tokenizeSearchQuery('  ')).toEqual([]);
  });
});

describe('rankSearchEntries()', () => {
  interface TestMethod {
    readonly id: string;
    readonly description?: string;
  }

  const methods: TestMethod[] = [{ id: 'worker.create', description: 'Creates a new worker.' }, { id: 'jobWorkerTimesheet.update.reopen', description: 'Reopens a closed timesheet.' }, { id: 'worker.update.schedule' }, { id: 'model-get', description: 'Reads documents by key.' }];
  const entries = buildRankedSearchEntries(methods, [
    { read: (x) => x.id, weights: RANKED_SEARCH_NAME_WEIGHTS },
    { read: (x) => x.description, weights: RANKED_SEARCH_TEXT_WEIGHTS }
  ]);

  it('should rank the best match first', () => {
    const results = rankSearchEntries({ entries, query: 'reopen timesheet' });
    expect(results.map((x) => x.value.id)).toEqual(['jobWorkerTimesheet.update.reopen']);
  });

  it('should require every token in all mode', () => {
    const results = rankSearchEntries({ entries, query: 'worker schedule' });
    expect(results.map((x) => x.value.id)).toEqual(['worker.update.schedule']);
  });

  it('should match any token in any mode', () => {
    const results = rankSearchEntries({ entries, query: 'worker schedule', mode: 'any' });
    expect(results[0].value.id).toBe('worker.update.schedule');
    expect(results.map((x) => x.value.id)).toContain('worker.create');
  });

  it('should match prefixes and substrings', () => {
    expect(rankSearchEntries({ entries, query: 'timesh' }).map((x) => x.value.id)).toEqual(['jobWorkerTimesheet.update.reopen']);
    expect(rankSearchEntries({ entries, query: 'imeshe' }).map((x) => x.value.id)).toEqual(['jobWorkerTimesheet.update.reopen']);
  });

  it('should boost a whole-query match', () => {
    const results = rankSearchEntries({ entries, query: 'worker.create', mode: 'any' });
    expect(results[0].value.id).toBe('worker.create');
  });

  it('should apply the filter and limit', () => {
    const results = rankSearchEntries({ entries, query: 'worker', filter: (x) => x.id !== 'worker.create', limit: 1 });
    expect(results.map((x) => x.value.id)).toEqual(['jobWorkerTimesheet.update.reopen']); // ties keep input order
  });

  it('should return nothing for an empty query', () => {
    expect(rankSearchEntries({ entries, query: '' })).toEqual([]);
  });
});
