import { type ViewContainerRef, type OnInit, type OnDestroy, Directive, Injector, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxInjectionComponentConfig, type DbxInjectionTemplateConfig } from './injection';
import { DbxInjectionInstance as DbxInjectionInstance } from './injection.instance';
import { type ObservableOrValueGetter } from '@dereekb/rxjs';

/**
 * Abstract base directive for dynamically injecting components or templates into a view.
 *
 * Manages a {@link DbxInjectionInstance} lifecycle, initializing it on `ngOnInit` and
 * destroying it on `ngOnDestroy`. Subclasses are responsible for wiring their inputs
 * (config, template, content) to the corresponding setter methods.
 *
 * @typeParam T - The type of the dynamically created component.
 *
 * @see {@link DbxInjectionComponent} - The concrete standalone component implementation.
 * @see {@link DbxInjectionInstance}
 */
@Directive()
export abstract class AbstractDbxInjectionDirective<T> implements OnInit, OnDestroy {
  private readonly _instance = new DbxInjectionInstance<T>(inject(Injector));

  ngOnInit(): void {
    this._instance.init();
  }

  ngOnDestroy(): void {
    this._instance.destroy();
  }

  /**
   * Sets the component injection configuration on the underlying {@link DbxInjectionInstance}.
   *
   * @param config - The component config, observable, or getter to use.
   */
  setConfig(config: Maybe<ObservableOrValueGetter<Maybe<DbxInjectionComponentConfig<T>>>>) {
    this._instance.config = config;
  }

  /**
   * Sets the template injection configuration on the underlying {@link DbxInjectionInstance}.
   *
   * @param template - The template config, observable, or getter to use.
   */
  setTemplate(template: Maybe<ObservableOrValueGetter<Maybe<DbxInjectionTemplateConfig<T>>>>) {
    this._instance.template = template;
  }

  /**
   * Sets the target `ViewContainerRef` where dynamic content will be inserted.
   *
   * @param content - The view container reference for content projection.
   */
  setContent(content: Maybe<ViewContainerRef>) {
    this._instance.content = content;
  }
}
