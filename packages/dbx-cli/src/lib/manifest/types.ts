import { type Type } from 'arktype';

export type CliApiVerb = 'create' | 'read' | 'update' | 'delete' | 'query' | 'standalone';

export interface CliApiManifestField {
  readonly name: string;
  readonly typeText: string;
  readonly description?: string;
}

export interface CliApiManifestEntry {
  readonly model: string;
  readonly verb: CliApiVerb;
  readonly specifier?: string;
  readonly paramsTypeName?: string;
  readonly paramsValidator?: Type<unknown>;
  readonly resultTypeName?: string;
  readonly groupName: string;
  readonly sourceFile: string;
  readonly description?: string;
  readonly paramsFields?: readonly CliApiManifestField[];
}

export type CliApiManifest = readonly CliApiManifestEntry[];
