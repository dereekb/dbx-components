import { ComponentRef, ViewContainerRef } from '@angular/core';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { DbxInjectedComponentConfig, DbxInjectedTemplateConfig } from './injected';
import { Initialized, Destroyable, Maybe } from '@dereekb/util';
import { SubscriptionObject, filterMaybe, skipFirstMaybe } from '@dereekb/rxjs';

/**
 * Instance used by components to inject content based on the configuration into the view.
 */
export class DbxInjectedComponentInstance<T> implements Initialized, Destroyable {

  private _subscriptionObject = new SubscriptionObject();

  private _config = new BehaviorSubject<Maybe<DbxInjectedComponentConfig<T>>>(undefined);
  private _template = new BehaviorSubject<Maybe<DbxInjectedTemplateConfig<T>>>(undefined);

  private _content = new BehaviorSubject<Maybe<ViewContainerRef>>(undefined);
  private _componentRef = new BehaviorSubject<Maybe<ComponentRef<T>>>(undefined);

  readonly config$ = this._config.pipe(distinctUntilChanged());
  readonly template$ = this._template.pipe(distinctUntilChanged());
  readonly content$ = this._content.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  get config(): Maybe<DbxInjectedComponentConfig<T>> {
    return this._config.value;
  }

  set config(config: Maybe<DbxInjectedComponentConfig<T>>) {
    this._config.next(config);
  }

  get template(): Maybe<DbxInjectedTemplateConfig<T>> {
    return this._template.value;
  }

  set template(template: Maybe<DbxInjectedTemplateConfig<T>>) {
    this._template.next(template);
  }

  get content(): Maybe<Maybe<ViewContainerRef>> {
    return this._content.value;
  }

  set content(content: Maybe<Maybe<ViewContainerRef>>) {
    this._content.next(content);
  }

  get componentRef(): Maybe<ComponentRef<T>> {
    return this._componentRef.value;
  }

  set componentRef(componentRef: Maybe<ComponentRef<T>>) {
    this._componentRef.next(componentRef);
  }

  init(): void {

    // Wait until the first of either of the two inputs comes in as not defined, and then emit.
    // We filter the first maybe here between the two items.
    const configTemplateObs = combineLatest([this.config$, this.template$]).pipe(
      map(([config, template]) => {
        if (config || template) {
          return {
            config,
            template
          };
        } else {
          return undefined;
        }
      }),
      skipFirstMaybe()
    );

    this._subscriptionObject.subscription = combineLatest([configTemplateObs, this.content$]).subscribe(([inputConfig, content]) => {
      const { config, template } = inputConfig ?? {};
      this._reset(content);

      if (config) {
        this._initComponent(config, content);
      } else if (template) {
        this._initTemplate(template, content);
      }
    });
  }

  destroy(): void {
    this._config.complete();
    this._template.complete();
    this._content.complete();
    this._componentRef.complete();
  }

  private _initComponent(config: DbxInjectedComponentConfig<T>, content: ViewContainerRef): void {
    content.clear();

    const { init, injector, componentClass } = config;

    const componentRef: ComponentRef<T> = content.createComponent(componentClass, { injector });

    const instance = componentRef.instance;

    if (init) {
      init(instance);
    }

    this.componentRef = componentRef;
  }

  private _initTemplate(config: DbxInjectedTemplateConfig<T>, content: ViewContainerRef): void {
    content.clear();

    const { templateRef, viewRef } = config;

    if (templateRef) {
      content.createEmbeddedView(templateRef);

      // TODO: Figure out if these items need to be destroyed or not when this item is destroyed. If so, we need a reference to destroy.

    } else if (viewRef) {
      content.insert(viewRef)
    }
  }

  private _reset(content: ViewContainerRef): void {
    if (this.componentRef) {
      content.clear();
      this.componentRef = undefined;
    }
  }

}
