import { inject, Injectable } from '@angular/core';
import { type ArrayOrValue, type Maybe, useIterableOrValue } from '@dereekb/util';
import { type DbxColorConfig, type DbxColorConfigTemplate, type DbxColorConfigTemplateKey } from './style';

/**
 * Configuration provided in the root module/environment for seeding {@link DbxColorService} with initial templates.
 */
export abstract class DbxColorServiceConfig {
  /**
   * Templates to register at service construction time.
   */
  abstract readonly templates?: Maybe<DbxColorConfigTemplate[]>;
}

/**
 * Service that registers named {@link DbxColorConfigTemplate} entries and expands
 * {@link DbxColorConfig} values that reference a template by key.
 *
 * Seeded via `provideDbxStyleService({ dbxColorServiceConfig: { templates: [...] } })`,
 * then injected by {@link DbxColorDirective} and {@link DbxTextColorDirective} to resolve
 * template references at render time.
 *
 * @dbxWebComponent
 * @dbxWebSlug color-service
 * @dbxWebCategory layout
 * @dbxWebRelated color, text-color, style-service
 *
 * @example
 * ```ts
 * const colorService = inject(DbxColorService);
 * colorService.register({ key: 'brand-positive', config: { color: '#1f9b59', contrast: 'white', tone: 18 } });
 * colorService.expandColorConfig({ template: 'brand-positive' });
 * // -> { template: 'brand-positive', color: '#1f9b59', contrast: 'white', tone: 18 }
 * ```
 */
@Injectable()
export class DbxColorService {
  private readonly _templates = new Map<DbxColorConfigTemplateKey, DbxColorConfigTemplate>();

  constructor() {
    const initialConfig = inject(DbxColorServiceConfig, { optional: true });

    if (initialConfig?.templates) {
      this.register(initialConfig.templates);
    }
  }

  /**
   * Registers one or more {@link DbxColorConfigTemplate} entries.
   *
   * @param templates - The template(s) to register.
   * @param override - Whether existing entries with the same key should be replaced (default true)
   */
  register(templates: ArrayOrValue<DbxColorConfigTemplate>, override: boolean = true): void {
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
  hasTemplate(key: DbxColorConfigTemplateKey): boolean {
    return this._templates.has(key);
  }

  /**
   * Returns the {@link DbxColorConfigTemplate} registered under the given key, or undefined if none.
   *
   * @param key - The template key to look up.
   * @returns The registered template, or undefined when no template matches.
   */
  getTemplate(key: DbxColorConfigTemplateKey): Maybe<DbxColorConfigTemplate> {
    return this._templates.get(key);
  }

  /**
   * Returns all currently registered template keys.
   *
   * @returns Array of all registered template keys.
   */
  getAllRegisteredTemplateKeys(): DbxColorConfigTemplateKey[] {
    return [...this._templates.keys()];
  }

  /**
   * Resolves the {@link DbxColorConfig.template} reference (if any) and merges the template's
   * fields beneath the input config. Input config fields override the template's fields.
   *
   * Returns the input unchanged when no template is set or when the template key is unknown.
   *
   * @param config - The input config to expand.
   * @returns An expanded config, or the input unchanged when no expansion applies.
   *
   * @example
   * ```ts
   * service.register({ key: 'brand-positive', config: { color: '#1f9b59', contrast: 'white', tone: 18 } });
   * service.expandColorConfig({ template: 'brand-positive' });
   * // -> { template: 'brand-positive', color: '#1f9b59', contrast: 'white', tone: 18 }
   * service.expandColorConfig({ template: 'brand-positive', tone: 60 });
   * // -> { template: 'brand-positive', color: '#1f9b59', contrast: 'white', tone: 60 }
   * ```
   */
  expandColorConfig(config: Maybe<DbxColorConfig>): Maybe<DbxColorConfig> {
    let result: Maybe<DbxColorConfig> = config;

    if (config?.template) {
      const template = this._templates.get(config.template);

      if (template) {
        result = { ...template.config, ...config };
      }
    }

    return result;
  }
}
