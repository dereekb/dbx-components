/**
 * Types for `dbx_model_api_lookup`.
 */

import type { CrudEntry } from '../model-api-shared/types.js';

export interface ApiLookupEntry extends CrudEntry {
  readonly sourceFile: string;
  readonly paramsJsDoc: string | undefined;
  readonly paramsFields: readonly ApiLookupField[];
  readonly resultJsDoc: string | undefined;
  readonly resultFields: readonly ApiLookupField[];
  readonly action: ActionResolution | undefined;
  readonly factory: FactoryResolution | undefined;
}

export interface ApiLookupField {
  readonly name: string;
  readonly typeText: string;
  readonly jsDoc: string | undefined;
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
