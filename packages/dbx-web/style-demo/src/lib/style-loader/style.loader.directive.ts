import { Directive, computed, inject, input } from '@angular/core';
import { type CssStyleObject, type Maybe, type SpaceSeparatedCssClasses, asArray, spaceSeparatedCssClasses } from '@dereekb/util';
import { type DbxStyleDemoStyleLoaderInput, type DbxStyleDemoStyleSet, isDbxStyleDemoStyleLoaderConfig, isDbxStyleDemoStyleTemplate, mergeDbxStyleDemoStyleTemplates } from './style.template';
import { DbxStyleDemoStyleLoaderService } from './style.loader.service';

/**
 * Applies a merged bundle of style-demo template levers to its host element, repainting every dbx component
 * beneath it via the CSS custom-property cascade.
 *
 * The input accepts either one or more registered template keys (`ArrayOrValue<DbxStyleDemoStyleTemplateKey>`) or a
 * {@link DbxStyleDemoStyleLoaderConfig} carrying inline template objects. The {@link DbxStyleDemoStyleLoaderService} is
 * optional-injected: when present, string keys are resolved through the registry (unknown keys skipped); when absent,
 * only inline template objects are merged (string keys are unresolvable and skipped). Merged inline CSS-token overrides
 * bind to the host `[style]` and merged debug classes bind to the host `[class]`.
 *
 * This directive is demo/debug-only and disposable — it is not a dbx-web core runtime primitive.
 *
 * @example
 * ```html
 * <div [dbxStyleDemoStyleLoader]="['corner-shape-large', 'surface-tint']">…</div>
 * <div [dbxStyleDemoStyleLoader]="{ templates: [{ key: 'pink', style: { '--mat-sys-primary': '#ff0066' } }] }">…</div>
 * ```
 */
@Directive({
  selector: '[dbxStyleDemoStyleLoader]',
  host: {
    '[class]': 'classesSignal()',
    '[style]': 'styleSignal()'
  },
  standalone: true
})
export class DbxStyleDemoStyleLoaderDirective {
  private readonly _loaderService = inject(DbxStyleDemoStyleLoaderService, { optional: true });

  /**
   * Template keys to resolve through the service, or a config object carrying inline templates.
   */
  readonly dbxStyleDemoStyleLoader = input<Maybe<DbxStyleDemoStyleLoaderInput>>(undefined);

  private readonly _mergedSignal = computed<DbxStyleDemoStyleSet>(() => {
    const input = this.dbxStyleDemoStyleLoader();
    const keysOrTemplates = isDbxStyleDemoStyleLoaderConfig(input) ? input.templates : input;
    const service = this._loaderService;

    let result: DbxStyleDemoStyleSet;

    if (service) {
      result = service.mergeTemplates(keysOrTemplates ?? []);
    } else {
      // No service: only inline template objects can be merged; string keys are unresolvable and skipped.
      result = mergeDbxStyleDemoStyleTemplates(asArray(keysOrTemplates).filter(isDbxStyleDemoStyleTemplate));
    }

    return result;
  });

  readonly styleSignal = computed<Maybe<CssStyleObject>>(() => {
    const { style } = this._mergedSignal();
    return Object.keys(style).length > 0 ? style : null;
  });

  readonly classesSignal = computed<SpaceSeparatedCssClasses>(() => spaceSeparatedCssClasses(this._mergedSignal().classes));
}
