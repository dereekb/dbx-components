import { type ArrayOrValue, type CssClass, type CssStyleObject, type Maybe, asArray, cssClassesSet } from '@dereekb/util';

/**
 * Identifier for a {@link DbxStyleDemoStyleTemplate} registered with the {@link DbxStyleDemoStyleLoaderService}.
 *
 * Use a kebab-case string (e.g. `'corner-shape-large'`) to reference a template by key.
 */
export type DbxStyleDemoStyleTemplateKey = string;

/**
 * A named bundle of CSS-token overrides (and/or debug classes) the style-demo playground can toggle on a rendered region.
 *
 * Templates are the "levers" flipped in the showcase: applying one re-points CSS custom properties (e.g. `--mat-sys-*`)
 * and/or attaches debug classes so that every dbx component beneath the loader host repaints live via the cascade.
 *
 * This type is demo/debug-only and disposable — it is not a dbx-web core runtime primitive.
 */
export interface DbxStyleDemoStyleTemplate {
  /**
   * Unique key identifying this template.
   */
  readonly key: DbxStyleDemoStyleTemplateKey;
  /**
   * Inline CSS-token overrides applied to the loader host's `[style]` (e.g. `{ '--mat-sys-primary': '#ff0066' }`).
   *
   * When several templates are merged, later templates' style keys win.
   */
  readonly style?: Maybe<CssStyleObject>;
  /**
   * Debug class(es) applied to the loader host (e.g. `'dbx-style-demo-template-corner-shape-large'`).
   *
   * When several templates are merged, classes accumulate and de-duplicate (order-preserving).
   */
  readonly className?: Maybe<ArrayOrValue<CssClass>>;
  /**
   * Optional human-readable label shown in the controls UI. Falls back to the {@link key} when unset.
   */
  readonly label?: Maybe<string>;
  /**
   * When true, the template participates in the "curated" set surfaced as a default lever in the controls UI.
   */
  readonly curated?: Maybe<boolean>;
}

/**
 * Configuration object accepted by the `[dbxStyleDemoStyleLoader]` directive when an inline list of templates
 * (rather than a list of registered keys) should be applied.
 *
 * @example
 * ```html
 * <div [dbxStyleDemoStyleLoader]="{ templates: [{ key: 'pink', style: { '--mat-sys-primary': '#ff0066' } }] }">…</div>
 * ```
 */
export interface DbxStyleDemoStyleLoaderConfig {
  /**
   * Template keys to resolve through the service, and/or inline template objects to merge directly.
   */
  readonly templates: ArrayOrValue<DbxStyleDemoStyleTemplateKey | DbxStyleDemoStyleTemplate>;
}

/**
 * Union accepted by the `[dbxStyleDemoStyleLoader]` directive input: one or more template keys, or a config object.
 */
export type DbxStyleDemoStyleLoaderInput = ArrayOrValue<DbxStyleDemoStyleTemplateKey> | DbxStyleDemoStyleLoaderConfig;

/**
 * The flattened result of merging one or more {@link DbxStyleDemoStyleTemplate} entries.
 *
 * Ready to bind to a host element's `[style]` (the {@link style} POJO) and `[class]` (the {@link classes}).
 */
export interface DbxStyleDemoStyleSet {
  /**
   * Merged inline CSS-token overrides (later templates win on conflicting keys).
   */
  readonly style: CssStyleObject;
  /**
   * Merged debug classes (de-duplicated, order-preserving).
   */
  readonly classes: CssClass[];
}

/**
 * Merges an ordered list of {@link DbxStyleDemoStyleTemplate} entries into a single {@link DbxStyleDemoStyleSet}.
 *
 * Style POJOs are merged with `{ ...acc, ...template.style }` so later templates override earlier ones on
 * conflicting token keys; classes accumulate across all templates and are de-duplicated order-preserving via
 * {@link cssClassesSet}.
 *
 * @param templates - The templates to merge, in precedence order (earliest first, latest wins).
 * @returns The merged style set.
 *
 * @example
 * ```ts
 * mergeDbxStyleDemoStyleTemplates([
 *   { key: 'a', style: { '--mat-sys-primary': 'red' }, className: 'x' },
 *   { key: 'b', style: { '--mat-sys-primary': 'blue' }, className: ['x', 'y'] }
 * ]);
 * // -> { style: { '--mat-sys-primary': 'blue' }, classes: ['x', 'y'] }
 * ```
 */
export function mergeDbxStyleDemoStyleTemplates(templates: DbxStyleDemoStyleTemplate[]): DbxStyleDemoStyleSet {
  let style: CssStyleObject = {};
  const classInputs: CssClass[] = [];

  templates.forEach((template) => {
    if (template.style) {
      style = { ...style, ...template.style };
    }

    if (template.className != null) {
      classInputs.push(...asArray(template.className));
    }
  });

  return { style, classes: [...cssClassesSet(classInputs)] };
}

/**
 * Type guard: true when the value is a {@link DbxStyleDemoStyleTemplate} object (not a bare template-key string).
 *
 * @param value - The value to test.
 * @returns `true` when the value is an object carrying a string `key`.
 *
 * @example
 * ```ts
 * isDbxStyleDemoStyleTemplate('corner-shape-large'); // false
 * isDbxStyleDemoStyleTemplate({ key: 'corner-shape-large' }); // true
 * ```
 */
export function isDbxStyleDemoStyleTemplate(value: Maybe<DbxStyleDemoStyleTemplateKey | DbxStyleDemoStyleTemplate>): value is DbxStyleDemoStyleTemplate {
  return typeof value === 'object' && value !== null && typeof value.key === 'string';
}

/**
 * Type guard: true when the directive input is a {@link DbxStyleDemoStyleLoaderConfig} (rather than a key / array of keys).
 *
 * @param value - The value to test.
 * @returns `true` when the value is a non-array object carrying a `templates` property.
 *
 * @example
 * ```ts
 * isDbxStyleDemoStyleLoaderConfig('corner-shape-large'); // false
 * isDbxStyleDemoStyleLoaderConfig(['a', 'b']); // false
 * isDbxStyleDemoStyleLoaderConfig({ templates: ['a'] }); // true
 * ```
 */
export function isDbxStyleDemoStyleLoaderConfig(value: Maybe<DbxStyleDemoStyleLoaderInput>): value is DbxStyleDemoStyleLoaderConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'templates' in value;
}
