import { type ModelFieldConversions, makeModelMapFunctions, type Maybe, type ModelConversionOptions, modifyModelMapFunctions, toModelFieldConversions } from '@dereekb/util';
import { type PartialWithFieldValue, type SnapshotOptions, type SetOptions, type WithFieldValue, type DocumentSnapshot, type SetOptionsMerge, type SetOptionsMergeFields, asTopLevelFieldPaths } from '../types';
import { type FirestoreModelData, type SnapshotConverterConfig, type SnapshotConverterFromFunction, type SnapshotConverterFunctions, type SnapshotConverterToFunction } from './snapshot.type';

// MARK: Snapshots
export function snapshotConverterFunctions<T extends object, O extends object = FirestoreModelData<T>>(config: SnapshotConverterConfig<T, O>): SnapshotConverterFunctions<T, O> {
  const conversions: ModelFieldConversions<T, O> = toModelFieldConversions<T, O>(config);
  const baseMapFunctions = makeModelMapFunctions<T, O>(conversions);
  const mapFunctions = config.modifiers ? modifyModelMapFunctions({ mapFunctions: baseMapFunctions, modifiers: config.modifiers }) : baseMapFunctions;
  const { from: fromData, to: toData } = mapFunctions;

  const from: SnapshotConverterFromFunction<T, O> = (input: DocumentSnapshot, target?: Maybe<Partial<T>>) => {
    const data = input.data();
    return fromData(data as O, target);
  };

  const to: SnapshotConverterToFunction<T, O> = (input: T, target?: Maybe<Partial<O>>, options?: Maybe<SetOptions>) => {
    let toOptions: Maybe<ModelConversionOptions<T>>;

    if (options) {
      const mergeFields = (options as SetOptionsMergeFields).mergeFields;

      if ((options as SetOptionsMerge).merge) {
        toOptions = {
          definedOnly: true
        };
      }

      if (mergeFields) {
        toOptions = {
          ...toOptions,
          fields: asTopLevelFieldPaths(mergeFields) as (keyof T)[]
        };
      }
    }

    return toData(input, target, toOptions);
  };

  return {
    from,
    to,
    mapFunctions,
    fromFirestore: (snapshot: DocumentSnapshot<O>, options?: SnapshotOptions) => from(snapshot, undefined, options),
    toFirestore: (modelObject: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SetOptions) => to(modelObject as T, undefined, options)
  };
}
