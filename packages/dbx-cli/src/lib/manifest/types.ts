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
  /**
   * Per-action description, rendered as the command's `describe` in `--help`.
   */
  readonly description?: string;
  /**
   * Description from the params interface's own JSDoc (e.g. on `ResetProfilePasswordParams`).
   * Rendered in the `--help` epilogue under the params section.
   */
  readonly paramsTypeDescription?: string;
  /**
   * Per-field params descriptions read from the params interface's property JSDocs.
   */
  readonly paramsFields?: readonly CliApiManifestField[];
  /**
   * Description from the result interface's own JSDoc (e.g. on `DownloadProfileArchiveResult`).
   * Surfaces the same way `paramsTypeDescription` does, but for the response side.
   */
  readonly resultTypeDescription?: string;
  /**
   * Per-field result descriptions read from the result interface's property JSDocs.
   */
  readonly resultFields?: readonly CliApiManifestField[];
}

export type CliApiManifest = readonly CliApiManifestEntry[];
