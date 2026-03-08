import { mergeMongoDBLikeRangeFilters, makeMongoDBLikeDateQueryBuilder, type MongoDBLikeDateRangeFilter } from './query.builder.mongo';

describe('mergeMongoDBLikeRangeFilters()', () => {
  it('should take $lte from startsAt and $gte from endsAt', () => {
    const startsAt: MongoDBLikeDateRangeFilter = { $lte: new Date('2026-12-31') };
    const endsAt: MongoDBLikeDateRangeFilter = { $gte: new Date('2026-01-01') };

    const result = mergeMongoDBLikeRangeFilters(startsAt, endsAt);

    expect(result.$lte).toEqual(new Date('2026-12-31'));
    expect(result.$gte).toEqual(new Date('2026-01-01'));
  });

  it('should fall back to endsAt $lte when startsAt has none', () => {
    const endsAt: MongoDBLikeDateRangeFilter = { $lte: new Date('2026-06-30'), $gte: new Date('2026-01-01') };

    const result = mergeMongoDBLikeRangeFilters(undefined, endsAt);

    expect(result.$lte).toEqual(new Date('2026-06-30'));
    expect(result.$gte).toEqual(new Date('2026-01-01'));
  });

  it('should fall back to startsAt $gte when endsAt has none', () => {
    const startsAt: MongoDBLikeDateRangeFilter = { $lte: new Date('2026-12-31'), $gte: new Date('2026-01-01') };

    const result = mergeMongoDBLikeRangeFilters(startsAt, undefined);

    expect(result.$lte).toEqual(new Date('2026-12-31'));
    expect(result.$gte).toEqual(new Date('2026-01-01'));
  });
});

describe('makeMongoDBLikeDateQueryBuilder()', () => {
  describe('two-field model', () => {
    const builder = makeMongoDBLikeDateQueryBuilder({
      fields: { start: 'startsAt', end: 'endsAt' }
    });

    describe('makeRangeFilter()', () => {
      it('should create a filter with $gte and $lte', () => {
        const gte = new Date('2026-01-01');
        const lte = new Date('2026-12-31');

        const result = builder.makeRangeFilter(gte, lte);

        expect(result).toEqual({ $gte: gte, $lte: lte });
      });

      it('should return undefined when both are undefined', () => {
        const result = builder.makeRangeFilter(undefined, undefined);
        expect(result).toBeUndefined();
      });

      it('should create a filter with only $gte', () => {
        const gte = new Date('2026-01-01');
        const result = builder.makeRangeFilter(gte, undefined);

        expect(result).toEqual({ $gte: gte });
      });
    });

    describe('makeFieldFilter()', () => {
      it('should create separate field filters for startsAt and endsAt', () => {
        const startsAt: MongoDBLikeDateRangeFilter = { $gte: new Date('2026-01-01') };
        const endsAt: MongoDBLikeDateRangeFilter = { $lte: new Date('2026-12-31') };

        const result = builder.makeFieldFilter({ startsAt, endsAt });

        expect(result).toEqual({
          startsAt: { $gte: new Date('2026-01-01') },
          endsAt: { $lte: new Date('2026-12-31') }
        });
      });

      it('should omit undefined filters', () => {
        const startsAt: MongoDBLikeDateRangeFilter = { $gte: new Date('2026-01-01') };
        const result = builder.makeFieldFilter({ startsAt });

        expect(result).toEqual({
          startsAt: { $gte: new Date('2026-01-01') }
        });
      });
    });
  });

  describe('single-field model', () => {
    const builder = makeMongoDBLikeDateQueryBuilder({
      fields: { start: 'date', singleFieldForStartAndEnd: true }
    });

    describe('makeFieldFilter()', () => {
      it('should merge startsAt and endsAt into a single field filter', () => {
        const startsAt: MongoDBLikeDateRangeFilter = { $lte: new Date('2026-12-31') };
        const endsAt: MongoDBLikeDateRangeFilter = { $gte: new Date('2026-01-01') };

        const result = builder.makeFieldFilter({ startsAt, endsAt });

        expect(result).toEqual({
          date: { $lte: new Date('2026-12-31'), $gte: new Date('2026-01-01') }
        });
      });
    });
  });
});
