import { type Maybe } from '@dereekb/util';
import { type DateQueryBuilder, type MakeFieldFilterInput } from './query.builder';

/**
 * Describes the document field names that store temporal start/end values,
 * used by {@link makeMongoDBLikeDateQueryBuilder} to produce query filters.
 */
export interface TimeFieldsNameSet {
  /**
   * Field name storing the start (or combined start+end) timestamp.
   */
  start: string;
  /**
   * Field name storing the end timestamp. Ignored when `singleFieldForStartAndEnd` is true.
   */
  end?: string;
  /**
   * When true, a single field represents both start and end so range bounds are merged.
   */
  singleFieldForStartAndEnd?: boolean;
}

/**
 * A MongoDB-style range filter object with optional upper and lower date bounds.
 */
export interface MongoDBLikeDateRangeFilter {
  $lte?: Date;
  $gte?: Date;
}

export type MongoDBLikeDateQueryFilter = object;

/**
 * Merges separate starts-at and ends-at range filters into a single
 * {@link MongoDBLikeDateRangeFilter} for documents that use one field
 * to represent both start and end.
 *
 * Takes `$lte` from `startsAt` (falling back to `endsAt`) and `$gte` from
 * `endsAt` (falling back to `startsAt`).
 *
 * @example
 * ```ts
 * const merged = mergeMongoDBLikeRangeFilters(
 *   { $lte: new Date('2026-12-31') },
 *   { $gte: new Date('2026-01-01') }
 * );
 * // { $lte: 2026-12-31, $gte: 2026-01-01 }
 * ```
 *
 * @param startsAt - Range filter derived from the starts-at bounds.
 * @param endsAt - Range filter derived from the ends-at bounds.
 * @returns A single merged range filter.
 */
export function mergeMongoDBLikeRangeFilters(startsAt: Maybe<MongoDBLikeDateRangeFilter>, endsAt: Maybe<MongoDBLikeDateRangeFilter>) {
  return {
    $lte: startsAt?.$lte ?? endsAt?.$lte,
    $gte: endsAt?.$gte ?? startsAt?.$gte
  };
}

export interface MakeMongoDBLikeDateQueryBuilderConfig {
  fields: TimeFieldsNameSet;
}

/**
 * Creates a {@link DateQueryBuilder} that produces MongoDB-style `$gte`/`$lte`
 * query filter objects for the configured time fields.
 *
 * Supports both two-field (start + end) and single-field date models.
 *
 * @example
 * ```ts
 * const builder = makeMongoDBLikeDateQueryBuilder({
 *   fields: { start: 'startsAt', end: 'endsAt' }
 * });
 * const filter = builder.makeFieldFilter({
 *   startsAt: { $gte: new Date('2026-01-01') }
 * });
 * ```
 *
 * @param config - Configuration specifying the document field names.
 * @returns A date query builder producing MongoDB-like filter objects.
 */
export function makeMongoDBLikeDateQueryBuilder(config: MakeMongoDBLikeDateQueryBuilderConfig): DateQueryBuilder<MongoDBLikeDateRangeFilter, MongoDBLikeDateQueryFilter> {
  const { fields } = config;

  return {
    makeRangeFilter(gte: Maybe<Date>, lte: Maybe<Date>) {
      let result: Maybe<MongoDBLikeDateRangeFilter>;

      if (gte || lte) {
        result = {
          ...(gte ? { $gte: gte } : undefined),
          ...(lte ? { $lte: lte } : undefined)
        };
      }

      return result;
    },
    makeFieldFilter({ startsAt, endsAt }: MakeFieldFilterInput<MongoDBLikeDateRangeFilter>) {
      let startsAtFilter;
      let endsAtFilter;

      if (fields.singleFieldForStartAndEnd) {
        // A single field that manages start/end will start and end at the same instant (end = start)
        // so we merge the gte/lte values.
        const merged: MongoDBLikeDateRangeFilter = mergeMongoDBLikeRangeFilters(startsAt, endsAt);
        startsAtFilter = { [fields.start]: merged };
      } else {
        startsAtFilter = startsAt ? { [fields.start]: startsAt } : undefined;
        endsAtFilter = endsAt && fields.end ? { [fields.end]: endsAt } : undefined;
      }

      return {
        ...startsAtFilter,
        ...endsAtFilter
      };
    }
  };
}
