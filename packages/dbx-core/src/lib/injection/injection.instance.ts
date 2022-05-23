import { ComponentRef, Injector, ViewContainerRef } from '@angular/core';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { DbxInjectionComponentConfig, DbxInjectionTemplateConfig, DBX_INJECTION_COMPONENT_DATA } from './injection';
import { Initialized, Destroyable, Maybe, mergeArrayOrValueIntoArray } from '@dereekb/util';
import { SubscriptionObject, filterMaybe, skipFirstMaybe } from '@dereekb/rxjs';

/**
 * Instance used by components to inject content based on the configuration into the view.
 */
export class DbxInjectionInstance<T> implements Initialized, Destroyable {

  private _subscriptionObject = new SubscriptionObject();

  private _config = new BehaviorSubject<Maybe<DbxInjectionComponentConfig<T>>>(undefined);
  private _template = new BehaviorSubject<Maybe<DbxInjectionTemplateConfig<T>>>(undefined);

  private _content = new BehaviorSubject<Maybe<ViewContainerRef>>(undefined);
  private _componentRef = new BehaviorSubject<Maybe<ComponentRef<T>>>(undefined);

  readonly config$ = this._config.pipe(distinctUntilChanged());
  readonly template$ = this._template.pipe(distinctUntilChanged());
  readonly content$ = this._content.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  get config(): Maybe<DbxInjectionComponentConfig<T>> {
    return this._config.value;
  }

  set config(config: Maybe<DbxInjectionComponentConfig<T>>) {
    this._config.next(config);
  }

  get template(): Maybe<DbxInjectionTemplateConfig<T>> {
    return this._template.value;
  }

  set template(template: Maybe<DbxInjectionTemplateConfig<T>>) {
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

  constructor(private readonly _injector: Injector) { }

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

  private _initComponent(config: DbxInjectionComponentConfig<T>, content: ViewContainerRef): void {
    content.clear();

    const { init, injector: inputInjector, providers, ngModuleRef, componentClass, data } = config;

    let injector: Injector | undefined;
    const parentInjector = inputInjector ?? this._injector;

    if (providers || data) {
      injector = Injector.create({
        parent: parentInjector,
        providers: mergeArrayOrValueIntoArray([{
          provide: DBX_INJECTION_COMPONENT_DATA,
          useValue: data
        }], providers ?? [])
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
