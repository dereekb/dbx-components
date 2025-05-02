import { ComponentRef, Injector, ViewContainerRef } from '@angular/core';
import { distinctUntilChanged, map, shareReplay, BehaviorSubject, combineLatest } from 'rxjs';
import { DbxInjectionComponentConfig, DbxInjectionTemplateConfig, DBX_INJECTION_COMPONENT_DATA } from './injection';
import { Initialized, Destroyable, Maybe, pushItemOrArrayItemsIntoArray } from '@dereekb/util';
import { ObservableOrValueGetter, SubscriptionObject, filterMaybe, maybeValueFromObservableOrValueGetter, skipFirstMaybe } from '@dereekb/rxjs';

/**
 * Instance used by components to inject content based on the configuration into the view.
 */
export class DbxInjectionInstance<T> implements Initialized, Destroyable {
  private readonly _subscriptionObject = new SubscriptionObject();

  private readonly _config = new BehaviorSubject<Maybe<ObservableOrValueGetter<DbxInjectionComponentConfig<T>>>>(undefined);
  private readonly _template = new BehaviorSubject<Maybe<ObservableOrValueGetter<DbxInjectionTemplateConfig<T>>>>(undefined);

  private readonly _content = new BehaviorSubject<Maybe<ViewContainerRef>>(undefined);
  private readonly _componentRef = new BehaviorSubject<Maybe<ComponentRef<T>>>(undefined);

  private readonly _injector: Injector;

  readonly config$ = this._config.pipe(maybeValueFromObservableOrValueGetter(), distinctUntilChanged(), shareReplay(1));
  readonly template$ = this._template.pipe(maybeValueFromObservableOrValueGetter(), distinctUntilChanged(), shareReplay(1));
  readonly content$ = this._content.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  get config(): Maybe<ObservableOrValueGetter<DbxInjectionComponentConfig<T>>> {
    return this._config.value;
  }

  set config(config: Maybe<ObservableOrValueGetter<DbxInjectionComponentConfig<T>>>) {
    this._config.next(config);
  }

  get template(): Maybe<ObservableOrValueGetter<DbxInjectionTemplateConfig<T>>> {
    return this._template.value;
  }

  set template(template: Maybe<ObservableOrValueGetter<DbxInjectionTemplateConfig<T>>>) {
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

  constructor(injector: Injector) {
    this._injector = injector;
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
    this._subscriptionObject.destroy();
    this._config.complete();
    this._template.complete();
    this._content.complete();
    this._componentRef.complete();
  }

  private _initComponent(config: DbxInjectionComponentConfig<T>, content: ViewContainerRef): void {
    content.clear();

    const { init, injector: inputInjector, providers, ngModuleRef, componentClass, data } = config;

    if (!componentClass) {
      throw new Error('DbxInjectionInstance: componentClass was expected in the config but it was unavailable.');
    }

    const parentInjector = inputInjector ?? this._injector;
    let injector: Injector | undefined = parentInjector;

    if (providers || data) {
      injector = Injector.create({
        parent: parentInjector,
        providers: pushItemOrArrayItemsIntoArray(
          [
            {
              provide: DBX_INJECTION_COMPONENT_DATA,
              useValue: data
            }
          ],
          providers ?? []
        )
      });
    }

    const componentRef: ComponentRef<T> = content.createComponent(componentClass, { injector, ngModuleRef });

    const instance = componentRef.instance;

    if (init) {
      init(instance);
    }

    this.componentRef = componentRef;
  }

  private _initTemplate(config: DbxInjectionTemplateConfig<T>, content: ViewContainerRef): void {
    content.clear();

    const { templateRef, viewRef } = config;

    if (templateRef) {
      content.createEmbeddedView(templateRef);

      // TODO: Figure out if these items need to be destroyed or not when this item is destroyed. If so, we need a reference to destroy.
    } else if (viewRef) {
      content.insert(viewRef);
    }
  }

  private _reset(content: ViewContainerRef): void {
    if (this.componentRef) {
      content.clear();
      this.componentRef = undefined;
    }
  }
}
