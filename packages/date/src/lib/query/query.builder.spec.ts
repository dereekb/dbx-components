import { makeDateQueryForOccuringFilter, makeDateQueryForDateItemRangeFilter, makeDateQueryForDateStartsEndsFilter, makeDaysAndTimeFiltersFunction, type DateQueryBuilder, type RawDateQuery } from './query.builder';
import { DateRangeType } from '../date/date.range';
import { type Maybe } from '@dereekb/util';

describe('makeDateQueryForOccuringFilter()', () => {
  it('should set startsLte and endsGte to the occurring date', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    const result = makeDateQueryForOccuringFilter({ occuringAt: date });

    expect(result.startsLte).toBe(date);
    expect(result.endsGte).toBe(date);
    expect(result.rStart).toBe(date);
    expect(result.rEnd).toBe(date);
  });

  it('should include the timezone when provided', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    const result = makeDateQueryForOccuringFilter({ occuringAt: date, timezone: 'America/Chicago' });

    expect(result.timezone).toBe('America/Chicago');
  });
});

describe('makeDateQueryForDateItemRangeFilter()', () => {
  it('should create a query for a DAY range', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    const result = makeDateQueryForDateItemRangeFilter({
      range: { type: DateRangeType.DAY, date }
    });

    expect(result.startsLte).toBeDefined();
    expect(result.endsGte).toBeDefined();
    expect(result.rStart).toBeDefined();
    expect(result.rEnd).toBeDefined();
  });

  it('should create a contained query when rangeContained is true', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    const result = makeDateQueryForDateItemRangeFilter({
      range: { type: DateRangeType.DAY, date },
      rangeContained: true
    });

    expect(result.startsGte).toBeDefined();
    expect(result.endsLte).toBeDefined();
  });

  it('should include the timezone when provided', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    const result = makeDateQueryForDateItemRangeFilter({
      range: { type: DateRangeType.WEEK, date },
      timezone: 'America/New_York'
    });

    expect(result.timezone).toBe('America/New_York');
  });
});

describe('makeDateQueryForDateStartsEndsFilter()', () => {
  it('should set startsGte and startsLte from starts filter', () => {
    const after = new Date('2026-01-01');
    const before = new Date('2026-12-31');

    const result = makeDateQueryForDateStartsEndsFilter({
      starts: { after, before }
    });

    expect(result.startsGte).toBe(after);
    expect(result.startsLte).toBe(before);
  });

  it('should set endsGte and endsLte from ends filter', () => {
    const after = new Date('2026-06-01');
    const before = new Date('2026-12-31');

    const result = makeDateQueryForDateStartsEndsFilter({
      ends: { after, before }
    });

    expect(result.endsGte).toBe(after);
    expect(result.endsLte).toBe(before);
  });

  it('should use at as both gte and lte when provided', () => {
    const at = new Date('2026-06-15');

    const result = makeDateQueryForDateStartsEndsFilter({
      starts: { at }
    });

    expect(result.startsGte).toBe(at);
    expect(result.startsLte).toBe(at);
  });

  it('should include timezone', () => {
    const result = makeDateQueryForDateStartsEndsFilter({
      starts: { after: new Date() },
      timezone: 'UTC'
    });

    expect(result.timezone).toBe('UTC');
  });
});

describe('makeDaysAndTimeFiltersFunction()', () => {
  interface TestRange {
    $gte?: Date;
    $lte?: Date;
  }
  type TestFilter = Record<string, TestRange>;

  const testBuilder: DateQueryBuilder<TestRange, TestFilter> = {
    makeRangeFilter(gte: Maybe<Date>, lte: Maybe<Date>) {
      let result: Maybe<TestRange>;

      if (gte || lte) {
        result = {};
        if (gte) result.$gte = gte;
        if (lte) result.$lte = lte;
      }

      return result;
    },
    makeFieldFilter({ startsAt, endsAt }) {
      const filter: TestFilter = {};
      if (startsAt) filter['startsAt'] = startsAt;
      if (endsAt) filter['endsAt'] = endsAt;
      return filter;
    }
  };

  it('should produce a time filter', () => {
    const filtersFunction = makeDaysAndTimeFiltersFunction(testBuilder);
    const rawQuery: RawDateQuery = {
      startsGte: new Date('2026-01-01'),
      endsLte: new Date('2026-12-31')
    };

    const result = filtersFunction(rawQuery);

    expect(result.timeFilter).toBeDefined();
    expect(result.daysFilter).toBeUndefined();
  });

  it('should produce a days filter when timezone is provided', () => {
    const filtersFunction = makeDaysAndTimeFiltersFunction(testBuilder);
    const rawQuery: RawDateQuery = {
      timezone: 'America/Chicago',
      startsGte: new Date('2026-01-01'),
      endsLte: new Date('2026-12-31')
    };

    const result = filtersFunction(rawQuery);

    expect(result.timeFilter).toBeDefined();
    expect(result.daysFilter).toBeDefined();
  });
});
