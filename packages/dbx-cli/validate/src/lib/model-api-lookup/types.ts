/**
 * Types for `dbx_model_api_lookup`.
 */

import type { CrudEntry } from '@dereekb/dbx-cli/manifest-extract';

export interface ApiLookupEntry extends CrudEntry {
  readonly sourceFile: string;
  readonly paramsJsDoc: string | undefined;
  readonly paramsFields: readonly ApiLookupField[];
  /**
   * `true` when the params interface carries `@dbxModelApiParams`. `false` when present but untagged.
   * `undefined` when no params interface could be resolved.
   */
  readonly paramsApiParamsTag: boolean | undefined;
  readonly resultJsDoc: string | undefined;
  readonly resultFields: readonly ApiLookupField[];
  readonly action: ActionResolution | undefined;
  readonly factory: FactoryResolution | undefined;
}

export interface ApiLookupField {
  readonly name: string;
  readonly typeText: string;
  readonly jsDoc: string | undefined;
  /**
   * `'adminOnly'` when the field is tagged `@dbxModelApiAdminOnly`, otherwise `'public'`.
   */
  readonly accessLevel: 'public' | 'adminOnly';
}

export interface ActionResolution {
  readonly className: string;
  readonly methodName: string;
  readonly sourceFile: string;
  readonly line: number;
  readonly jsDoc: string | undefined;
}

export interface FactoryResolution {
  readonly factoryName: string;
  readonly sourceFile: string;
  readonly line: number;
  readonly jsDoc: string | undefined;
}

export interface ApiLookupReport {
  readonly componentDir: string;
  readonly apiDir: string | undefined;
  readonly groupName: string | undefined;
  readonly modelFilter: string;
  readonly sourceFile: string | undefined;
  readonly modelKeys: readonly string[];
  readonly entries: readonly ApiLookupEntry[];
  readonly actionLookupStatus: ActionLookupStatus;
}

export type ActionLookupStatus = { readonly kind: 'skipped'; readonly reason: string } | { readonly kind: 'ok'; readonly filesScanned: number } | { readonly kind: 'error'; readonly message: string };
