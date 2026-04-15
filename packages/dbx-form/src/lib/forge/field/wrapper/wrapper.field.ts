import type { FieldDef, WrapperField } from '@ng-forge/dynamic-forms';
import { dbxForgeFieldFunction, DbxForgeFieldFunctionConfig, DbxForgeFieldFunctionDef, ExtractDbxForgeFieldDef } from '../field';

// MARK: Config
export type DbxForgeWrappedFieldDef<F> = Omit<WrapperField, 'fields'> & {
  readonly fields: [F];
};

export type DbxForgeWrappedFieldFunction<C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>, W extends DbxForgeWrappedFieldDef<F> = DbxForgeWrappedFieldDef<F>> = (input: C) => W;

export type DbxForgeWrappedFieldFunctionFactory<W extends DbxForgeWrappedFieldDef<any>> = <C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>>(fieldFunctionConfig: DbxForgeFieldFunctionConfig<C>) => DbxForgeWrappedFieldFunction<C, F, W>;

export interface DbxForgeWrappedFieldFunctionFactoryConfig<C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>> {
  readonly buildWrappers: (inputConfig: C, field: F) => WrapperField['wrappers'];
}

/**
 * @param config @
 * @returns
 */
export function dbxForgeWrapperFunctionFactory<W extends DbxForgeWrappedFieldDef<any>>(config: DbxForgeWrappedFieldFunctionFactoryConfig<any, any>): DbxForgeWrappedFieldFunctionFactory<W> {
  return <C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>>(fieldFunctionConfig: DbxForgeFieldFunctionConfig<C>) => {
    const fn = dbxForgeFieldFunction<C, F>(fieldFunctionConfig);

    return ((x: C) => {
      const field = fn(x as any) as F;

      const result: DbxForgeWrappedFieldDef<F> = {
        key: `${x.key}_wrapper`,
        type: 'wrapper',
        fields: [field as any],
        wrappers: config.buildWrappers(x, field)
      };

      return result;
    }) as DbxForgeWrappedFieldFunction<C, F, W>;
  };
}
