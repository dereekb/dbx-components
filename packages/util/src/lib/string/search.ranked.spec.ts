import { buildRankedSearchEntries, buildRankedSearchSynonyms, rankSearchEntries, RANKED_SEARCH_ENGLISH_STOP_WORDS, RANKED_SEARCH_NAME_WEIGHTS, RANKED_SEARCH_TEXT_WEIGHTS, splitSearchIdentifierWords, tokenizeSearchQuery } from './search.ranked';

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

  describe('stopWords', () => {
    it('should drop stop words from the query', () => {
      expect(rankSearchEntries({ entries, query: 'reopen the timesheet' })).toEqual([]);
      expect(rankSearchEntries({ entries, query: 'reopen the timesheet', stopWords: RANKED_SEARCH_ENGLISH_STOP_WORDS }).map((x) => x.value.id)).toEqual(['jobWorkerTimesheet.update.reopen']);
    });

    it('should keep every word of a query made only of stop words', () => {
      expect(rankSearchEntries({ entries, query: 'by', stopWords: RANKED_SEARCH_ENGLISH_STOP_WORDS }).map((x) => x.value.id)).toEqual(['model-get']);
    });
  });

  describe('synonyms', () => {
    const synonymMethods: TestMethod[] = [{ id: 'worker.delete', description: 'Deletes a worker.' }, { id: 'worker.update.removeShift', description: 'Removes one shift from a worker.' }, { id: 'cache.clear', description: 'Removes stale entries.' }, { id: 'worker.create' }];
    const synonymEntries = buildRankedSearchEntries(synonymMethods, [
      { read: (x) => x.id, weights: RANKED_SEARCH_NAME_WEIGHTS },
      { read: (x) => x.description, weights: RANKED_SEARCH_TEXT_WEIGHTS }
    ]);
    const synonyms = buildRankedSearchSynonyms([
      ['delete', 'remove'],
      ['remove', 'purge']
    ]);

    it('should match a word through its synonym', () => {
      expect(rankSearchEntries({ entries: synonymEntries, query: 'remove worker' }).map((x) => x.value.id)).toEqual(['worker.update.removeShift']);
      expect(rankSearchEntries({ entries: synonymEntries, query: 'remove worker', synonyms }).map((x) => x.value.id)).toEqual(['worker.update.removeShift', 'worker.delete']);
    });

    it('should rank a literal match above a synonym match', () => {
      const results = rankSearchEntries({ entries: synonymEntries, query: 'delete worker', synonyms });
      expect(results.map((x) => x.value.id)).toEqual(['worker.delete', 'worker.update.removeShift']);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should match a synonym only as an exact word', () => {
      expect(rankSearchEntries({ entries: synonymEntries, query: 'purge', synonyms }).map((x) => x.value.id)).toEqual(['worker.update.removeShift']);
    });
  });
});

describe('buildRankedSearchSynonyms()', () => {
  it('should map every word of a group to the others', () => {
    const synonyms = buildRankedSearchSynonyms([['Delete', 'remove', 'erase']]);
    expect(synonyms.get('delete')).toEqual(['remove', 'erase']);
    expect(synonyms.get('erase')).toEqual(['delete', 'remove']);
  });

  it('should union the groups a word appears in', () => {
    const synonyms = buildRankedSearchSynonyms([
      ['delete', 'remove'],
      ['remove', 'purge']
    ]);
    expect(synonyms.get('remove')).toEqual(['delete', 'purge']);
    expect(synonyms.get('purge')).toEqual(['remove']);
  });
});
