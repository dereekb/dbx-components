import { type Maybe, type PrimativeKey } from '@dereekb/util';
import { type BaseValueField } from '@ng-forge/dynamic-forms';
import { type Observable } from 'rxjs';
import { type SourceSelectDisplayFunction, type SourceSelectLoadSourcesFunction, type SourceSelectMetaValueReader, type SourceSelectOpenFunction, type SourceSelectValueMetaLoader } from '../../../../formly/field/selection/sourceselect/sourceselect';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';

// MARK: Field Type Name
/**
 * The custom forge field type name for the source select field.
 */
export const FORGE_SOURCE_SELECT_FIELD_TYPE = 'dbx-source-select' as const;

// MARK: Props
/**
 * Props interface for the forge source select field.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface DbxForgeSourceSelectFieldProps<T extends PrimativeKey = PrimativeKey, M = unknown> {
  readonly openSource?: Maybe<SourceSelectOpenFunction<M>>;
  readonly loadSources?: Maybe<SourceSelectLoadSourcesFunction<M>>;
  readonly valueReader: SourceSelectMetaValueReader<T, M>;
  readonly metaLoader: SourceSelectValueMetaLoader<T, M>;
  readonly displayForValue: SourceSelectDisplayFunction<T, M>;
  readonly selectButtonIcon?: Maybe<string>;
  readonly multiple?: Maybe<boolean>;
  readonly refreshDisplayValues$?: Maybe<Observable<unknown>>;
  readonly filterable?: Maybe<boolean>;
  readonly filterableGroups?: Maybe<boolean>;
  readonly hint?: Maybe<string>;
}

// MARK: Field Def
/**
 * Forge field definition interface for the source select field.
 */
export interface DbxForgeSourceSelectFieldDef<T extends PrimativeKey = PrimativeKey, M = unknown> extends BaseValueField<DbxForgeSourceSelectFieldProps<T, M>, T | T[]> {
  readonly type: typeof FORGE_SOURCE_SELECT_FIELD_TYPE;
}

// MARK: Source Select Field
/**
 * Configuration for a forge source select field.
 */
export interface DbxForgeSourceSelectFieldConfig<T extends PrimativeKey = PrimativeKey, M = unknown> extends DbxForgeFieldFunctionDef<DbxForgeSourceSelectFieldDef<T, M>> {}

export type DbxForgeSourceSelectFieldFunction = <T extends PrimativeKey = PrimativeKey, M = unknown>(config: DbxForgeSourceSelectFieldConfig<T, M>) => DbxForgeSourceSelectFieldDef<T, M>;

/**
 * Creates a forge field definition for a source select field.
 *
 * The component uses `<mat-form-field>` with `[formField]` for native ng-forge value binding,
 * proper Material rendering, and built-in logic (hidden/disabled/readonly) support.
 *
 * @param config - Source select field configuration
 * @returns A {@link DbxForgeSourceSelectFieldDef}
 *
 * @example
 * ```typescript
 * const field = dbxForgeSourceSelectField({
 *   key: 'source',
 *   label: 'Source',
 *   props: {
 *     valueReader: (meta) => meta.id,
 *     metaLoader: (values) => myService.loadMeta(values),
 *     displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta.name })))
 *   }
 * });
 * ```
 */
export const dbxForgeSourceSelectField = dbxForgeFieldFunction<DbxForgeSourceSelectFieldConfig>({
  type: FORGE_SOURCE_SELECT_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef(() => {
    // no-op
  })
}) as DbxForgeSourceSelectFieldFunction;
