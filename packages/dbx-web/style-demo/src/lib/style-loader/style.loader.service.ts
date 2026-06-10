import { Injectable, inject } from '@angular/core';
import { type ArrayOrValue, type Maybe, asArray, useIterableOrValue } from '@dereekb/util';
import { type DbxStyleDemoStyleSet, type DbxStyleDemoStyleTemplate, type DbxStyleDemoStyleTemplateKey, isDbxStyleDemoStyleTemplate, mergeDbxStyleDemoStyleTemplates } from './style.template';

/**
 * Configuration provided in the root environment for seeding {@link DbxStyleDemoStyleLoaderService} with initial templates.
 *
 * Registered via `provideDbxStyleDemo({ templates: [...] })`.
 */
export abstract class DbxStyleDemoStyleLoaderServiceConfig {
  /**
   * Templates to register at service construction time.
   */
  abstract readonly templates?: Maybe<DbxStyleDemoStyleTemplate[]>;
}

/**
 * Registry of named {@link DbxStyleDemoStyleTemplate} levers used by the style-demo playground.
 *
 * Mirrors the shape of `DbxColorService`: app-provided templates are seeded from an optional
 * {@link DbxStyleDemoStyleLoaderServiceConfig}, then resolved by key at render time by the
 * `[dbxStyleDemoStyleLoader]` directive. Ships with no built-in templates — every lever is contributed by an app.
 *
 * This service is demo/debug-only and disposable — it is not a dbx-web core runtime primitive.
 *
 * @example
 * ```ts
 * const loader = inject(DbxStyleDemoStyleLoaderService);
 * loader.register({ key: 'pink', style: { '--mat-sys-primary': '#ff0066' } });
 * loader.mergeTemplates(['pink']);
 * // -> { style: { '--mat-sys-primary': '#ff0066' }, classes: [] }
 * ```
 */
@Injectable()
export class DbxStyleDemoStyleLoaderService {
  private readonly _templates = new Map<DbxStyleDemoStyleTemplateKey, DbxStyleDemoStyleTemplate>();

  constructor() {
    const initialConfig = inject(DbxStyleDemoStyleLoaderServiceConfig, { optional: true });

    if (initialConfig?.templates) {
      this.register(initialConfig.templates);
    }
  }

  /**
   * Registers one or more {@link DbxStyleDemoStyleTemplate} entries.
   *
   * @param templates - The template(s) to register.
   * @param override - Whether existing entries with the same key should be replaced (default true)
   */
  register(templates: ArrayOrValue<DbxStyleDemoStyleTemplate>, override: boolean = true): void {
    useIterableOrValue(templates, (template) => {
      if (override || !this._templates.has(template.key)) {
        this._templates.set(template.key, template);
      }
    });
  }

  /**
   * Returns whether a template with the given key has been registered.
   *
   * @param key - The template key to check.
   * @returns True when a template is registered under the given key.
   */
  hasTemplate(key: DbxStyleDemoStyleTemplateKey): boolean {
    return this._templates.has(key);
  }

  /**
   * Returns the {@link DbxStyleDemoStyleTemplate} registered under the given key, or undefined if none.
   *
   * @param key - The template key to look up.
   * @returns The registered template, or undefined when no template matches.
   */
  getTemplate(key: DbxStyleDemoStyleTemplateKey): Maybe<DbxStyleDemoStyleTemplate> {
    return this._templates.get(key);
  }

  /**
   * Returns all currently registered template keys, in registration order.
   *
   * @returns Array of all registered template keys.
   */
  getAllRegisteredTemplateKeys(): DbxStyleDemoStyleTemplateKey[] {
    return [...this._templates.keys()];
  }

  /**
   * Returns all registered templates flagged {@link DbxStyleDemoStyleTemplate.curated}, in registration order.
   *
   * @returns The curated templates in insertion order.
   */
  getCuratedTemplates(): DbxStyleDemoStyleTemplate[] {
    return [...this._templates.values()].filter((template) => template.curated === true);
  }

  /**
   * Resolves a mix of template keys and inline templates into a single merged {@link DbxStyleDemoStyleSet}.
   *
   * String keys are resolved through the registry; unknown keys are skipped. Inline template objects are
   * used as-is. Resolution preserves input order so later entries win on conflicting style keys.
   *
   * @param keysOrTemplates - Template keys and/or inline templates to merge, in precedence order.
   * @returns The merged style set.
   *
   * @example
   * ```ts
   * loader.register({ key: 'pink', style: { '--mat-sys-primary': '#ff0066' } });
   * loader.mergeTemplates(['pink', 'unknown', { key: 'inline', className: 'demo' }]);
   * // -> { style: { '--mat-sys-primary': '#ff0066' }, classes: ['demo'] }
   * ```
   */
  mergeTemplates(keysOrTemplates: ArrayOrValue<DbxStyleDemoStyleTemplateKey | DbxStyleDemoStyleTemplate>): DbxStyleDemoStyleSet {
    const resolved: DbxStyleDemoStyleTemplate[] = [];

    asArray(keysOrTemplates).forEach((keyOrTemplate) => {
      if (isDbxStyleDemoStyleTemplate(keyOrTemplate)) {
        resolved.push(keyOrTemplate);
      } else {
        const template = this._templates.get(keyOrTemplate);

        if (template) {
          resolved.push(template);
        }
      }
    });

    return mergeDbxStyleDemoStyleTemplates(resolved);
  }
}
