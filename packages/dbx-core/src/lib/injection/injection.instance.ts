import { type ComponentRef, Injector, type ViewContainerRef } from '@angular/core';
import { distinctUntilChanged, map, shareReplay, BehaviorSubject, combineLatest } from 'rxjs';
import { type DbxInjectionComponentConfig, type DbxInjectionTemplateConfig, dbxInjectionComponentConfigIsEqual } from './injection';
import { type Initialized, type Destroyable, type Maybe } from '@dereekb/util';
import { type MaybeObservableOrValueGetter, SubscriptionObject, filterMaybe, maybeValueFromObservableOrValueGetter, skipAllInitialMaybe } from '@dereekb/rxjs';
import { createInjectorForInjectionComponentConfig, initInjectionComponent } from './injection.util';

/**
 * Core runtime engine for the dbx-injection system. Manages the lifecycle of dynamically injected
 * components and templates within an Angular `ViewContainerRef`.
 *
 * This class reactively listens to configuration and template observables. When a new
 * {@link DbxInjectionComponentConfig} or {@link DbxInjectionTemplateConfig} is emitted, it tears
 * down the previous content and creates the new component or template in the target view container.
 *
 * Component configs take precedence over template configs when both are provided.
 *
 * Typically used internally by {@link AbstractDbxInjectionDirective} and {@link DbxInjectionComponent}
 * rather than consumed directly.
 *
 * @typeParam T - The type of the dynamically created component.
 *
 * @see {@link DbxInjectionComponentConfig}
 * @see {@link DbxInjectionTemplateConfig}
 * @see {@link AbstractDbxInjectionDirective}
 */
export class DbxInjectionInstance<T> implements Initialized, Destroyable {
  private readonly _subscriptionObject = new SubscriptionObject();

  private readonly _config = new BehaviorSubject<MaybeObservableOrValueGetter<DbxInjectionComponentConfig<T>>>(undefined);
  private readonly _template = new BehaviorSubject<MaybeObservableOrValueGetter<DbxInjectionTemplateConfig<T>>>(undefined);

  private readonly _content = new BehaviorSubject<Maybe<ViewContainerRef>>(undefined);
  private readonly _componentRef = new BehaviorSubject<Maybe<ComponentRef<T>>>(undefined);

  private readonly _injector: Injector;

  readonly config$ = this._config.pipe(maybeValueFromObservableOrValueGetter(), distinctUntilChanged(dbxInjectionComponentConfigIsEqual), shareReplay(1));
  readonly template$ = this._template.pipe(maybeValueFromObservableOrValueGetter(), distinctUntilChanged(), shareReplay(1));
  readonly content$ = this._content.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  get config(): MaybeObservableOrValueGetter<DbxInjectionComponentConfig<T>> {
    return this._config.value;
  }

  set config(config: MaybeObservableOrValueGetter<DbxInjectionComponentConfig<T>>) {
    this._config.next(config);
  }

  get template(): MaybeObservableOrValueGetter<DbxInjectionTemplateConfig<T>> {
    return this._template.value;
  }

  set template(template: MaybeObservableOrValueGetter<DbxInjectionTemplateConfig<T>>) {
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
      skipAllInitialMaybe()
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

    const { componentClass, ngModuleRef } = config;

    if (!componentClass) {
      throw new Error('DbxInjectionInstance: componentClass was expected in the config but it was unavailable.');
    }

    const injector = createInjectorForInjectionComponentConfig({ config, parentInjector: this._injector });
    const componentRef: ComponentRef<T> = content.createComponent(componentClass, { injector, ngModuleRef });
    initInjectionComponent(componentRef, config);
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
