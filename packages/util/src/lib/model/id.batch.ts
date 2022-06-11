import { mergeIntoArray } from '../array';
import { ArrayFactory, AsyncArrayFactory } from '../array/array.factory';
import { FindUniqueFunction } from '../array/array.unique';
import { PromiseOrValue } from '../promise/promise';
import { performBatchLoop } from '../promise/promise.loop';

/**
 * Used by to verify tags have not already been taken.
 */
export type IdBatchVerifier<T> = {
  /**
   * Optional function to ensure uniqueness.
   */
  findUnique?: FindUniqueFunction<T>;
  /**
   * Used to verify each tag is available for use.
   */
  verify: (generatedIds: T[]) => PromiseOrValue<T[]>;
  /**
   * Max number of tags that can be verified per batch.
   */
  maxBatchSize: number;
};

export interface IdBatchFactoryConfig<T> {
  readonly factory: ArrayFactory<T>;
  readonly verifier: IdBatchVerifier<T>;
}

/**
 *
 */
export type IdBatchFactory<T> = AsyncArrayFactory<T>;

/**
 * Creates an IdBatchFactory
 *
 * @param config
 * @returns
 */
export function idBatchFactory<T>(config: IdBatchFactoryConfig<T>): IdBatchFactory<T> {
  const { factory, verifier } = config;
  const { maxBatchSize: tagsToGeneratePerBatch, findUnique = (x) => x, verify: verifyTags } = verifier;
  const maxUniquenessFailures = 20; // arbitrary failure point, but generally shouldn't occur with proper input.

  return async (totalTagIdentifiersToGenerate: number) => {
    const uniquenessAccumulator: T[] = []; // used for uniqueness checks

    async function generateIdentifiersBatch(batchSize: number): Promise<T[]> {
      let ids: T[] = [];

      let uniquenessFailure = 0;
      while (ids.length < batchSize) {
        const countToGenerate = batchSize - ids.length;
        const newIds = findUnique(factory(countToGenerate), uniquenessAccumulator);

        if (newIds.length === 0) {
          uniquenessFailure += 1;

          if (uniquenessFailure === maxUniquenessFailures) {
            throw new Error(`idBatchFactory failed generating unique values "${maxUniquenessFailures}" times. Factory may be insufficient for generating unique values.`);
          }
          continue;
        }

        // add to the uniqueness acumulator to prevent further usage
        mergeIntoArray(uniquenessAccumulator, newIds);

        const verifiedIds = await verifyTags(newIds);

        // concat identifiers
        ids = ids.concat(verifiedIds);

        // restart loop if there are still items to be generated.
      }

      return ids;
    }

    const tagBatches: T[][] = await performBatchLoop<T>({
      totalItems: totalTagIdentifiersToGenerate,
      itemsPerBatch: tagsToGeneratePerBatch,
      make: async (batchSize: number) => {
        const result: T[] = await generateIdentifiersBatch(batchSize);
        return result;
      }
    });

    return tagBatches.flat();
  };
}
