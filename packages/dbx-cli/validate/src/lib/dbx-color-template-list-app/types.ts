/**
 * Report shapes for `dbx_color_template_list_app`.
 *
 * The lister walks an Angular app's root config, finds the
 * `provideDbxStyleService(...)` call, and extracts every
 * `DbxColorConfigTemplate` registered via
 * `dbxColorServiceConfig.templates`. Unparseable entries surface
 * as warnings so callers can spot drift without the tool erroring out.
 */

/**
 * The four `DbxColorConfig` fields the lister recognises. All are optional —
 * a template can supply any subset.
 */
export interface ColorTemplateConfig {
  /**
   * Optional template-key reference. Captured so cross-template references
   * round-trip through the report, even though the validator does not
   * follow them transitively.
   */
  readonly template?: string;
  /**
   * Optional vibrant/background color value (any CSS color string).
   */
  readonly color?: string;
  /**
   * Optional contrast/foreground color value.
   */
  readonly contrast?: string;
  /**
   * Optional opacity (0–100) controlling the background mix.
   */
  readonly tone?: number;
  /**
   * Optional explicit tonal-mode flag.
   */
  readonly tonal?: boolean;
}

/**
 * One `DbxColorConfigTemplate` registered through
 * `provideDbxStyleService({ dbxColorServiceConfig: { templates: [...] } })`.
 */
export interface ColorTemplateEntry {
  readonly key: string;
  readonly config: ColorTemplateConfig;
  readonly sourceFile: string;
  readonly sourceLine: number;
}

/**
 * One non-fatal extraction issue. Surfaced as a warning instead of a hard
 * error so the rest of the report still renders.
 */
export interface ColorTemplateWarning {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

/**
 * Where the `provideDbxStyleService(...)` call was found, when located.
 */
export interface ColorTemplateProvideLocation {
  readonly file: string;
  readonly line: number;
}

/**
 * Output emitted by the `dbx_color_template_list_app` tool.
 */
export interface ColorTemplateListAppReport {
  readonly apiDir: string;
  readonly templates: readonly ColorTemplateEntry[];
  readonly warnings: readonly ColorTemplateWarning[];
  readonly provideCallLocation?: ColorTemplateProvideLocation;
}
