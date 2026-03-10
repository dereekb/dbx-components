import { Component, ViewContainerRef, input, viewChild, effect } from '@angular/core';
import { type DbxInjectionComponentConfig, type DbxInjectionTemplateConfig } from './injection';
import { AbstractDbxInjectionDirective } from './injection.directive';
import { type Maybe } from '@dereekb/util';
import { type ObservableOrValueGetter } from '@dereekb/rxjs';

/**
 * Standalone component for dynamically injecting a component or template into the DOM.
 *
 * Accepts a {@link DbxInjectionComponentConfig} (to create a component) or a
 * {@link DbxInjectionTemplateConfig} (to embed a template/view). When the config changes,
 * the previous content is destroyed and the new content is created in its place.
 *
 * Can be used as an element (`<dbx-injection>`) or as an attribute directive
 * (`[dbxInjection]` / `[dbx-injection]`).
 *
 * @typeParam T - The type of the dynamically created component.
 *
 * @example
 * ```html
 * <!-- Element usage with a component config -->
 * <dbx-injection [config]="myComponentConfig"></dbx-injection>
 *
 * <!-- Element usage with a template config -->
 * <dbx-injection [template]="myTemplateConfig"></dbx-injection>
 *
 * <!-- Attribute usage -->
 * <div dbxInjection [config]="myComponentConfig"></div>
 * ```
 *
 * @see {@link DbxInjectionComponentConfig}
 * @see {@link DbxInjectionTemplateConfig}
 * @see {@link AbstractDbxInjectionDirective}
 */
@Component({
  selector: 'dbx-injection, [dbxInjection], [dbx-injection]',
  template: `
    <ng-template #content></ng-template>
  `,
  imports: [],
  standalone: true
})
export class DbxInjectionComponent<T> extends AbstractDbxInjectionDirective<T> {
  /**
   * Reference to the internal view container where dynamic content is projected.
   */
  readonly content = viewChild('content', { read: ViewContainerRef });

  /**
   * The component injection configuration. Accepts an observable, getter, or static value.
   */
  readonly config = input<Maybe<ObservableOrValueGetter<Maybe<DbxInjectionComponentConfig<T>>>>>();

  /**
   * The template injection configuration. Accepts an observable, getter, or static value.
   * Only used when `config` is not provided.
   */
  readonly template = input<Maybe<ObservableOrValueGetter<Maybe<DbxInjectionTemplateConfig<T>>>>>();

  // allow signal writes for each as during their initialization they may write to a signal in some cases when initializing
  protected readonly _contentEffect = effect(() => this.setContent(this.content()));
  protected readonly _configEffect = effect(() => this.setConfig(this.config()));
  protected readonly _templateEffect = effect(() => this.setTemplate(this.template()));
}
