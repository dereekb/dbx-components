import { Maybe } from '@dereekb/util';
import { DateQueryBuilder, MakeFieldFilterInput } from './query.builder';

export interface TimeFieldsNameSet {
  start: string;
  end?: string;
  singleFieldForStartAndEnd?: boolean;
}

export interface MongoDBLikeDateRangeFilter {
  $lte?: Date;
  $gte?: Date;
}

export type MongoDBLikeDateQueryFilter = object;

export function mergeMongoDBLikeRangeFilters(startsAt: Maybe<MongoDBLikeDateRangeFilter>, endsAt: Maybe<MongoDBLikeDateRangeFilter>) {
  return {
    $lte: startsAt?.$lte ?? endsAt?.$lte,
    $gte: endsAt?.$gte ?? startsAt?.$gte
  };
}

export interface MakeMongoDBLikeDateQueryBuilderConfig {
  fields: TimeFieldsNameSet;
}

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
        startsAtFilter = merged ? { [fields.start]: merged } : undefined;
      } else {
        startsAtFilter = startsAt ? { [fields.start]: startsAt } : undefined;
        endsAtFilter = endsAt && fields.end ? { [fields.end]: endsAt } : undefined;
      }

      const filter = {
        ...startsAtFilter,
        ...endsAtFilter
      };

      return filter;
    }
  };
}
