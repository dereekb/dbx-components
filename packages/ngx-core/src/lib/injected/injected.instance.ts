import { Initialized } from './../../../../util/src/lib/lifecycle';
import { Destroyable } from '../../../../util/src/lib/lifecycle';
import { ComponentRef, EmbeddedViewRef, ViewContainerRef } from '@angular/core';
import { distinctUntilChanged, throttleTime, shareReplay } from 'rxjs/operators';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { DbNgxInjectedComponentConfig, DbNgxInjectedTemplateConfig } from './injected';
import { Maybe } from '@dereekb/util';
import { filterMaybe } from '@dereekb/util-rxjs';
import { SubscriptionObject } from '../subscription';

/**
 * Instance used by components to inject content based on the configuration into the view.
 */
export class DbNgxInjectedComponentInstance<T> implements Initialized, Destroyable {

  private _subscriptionObject = new SubscriptionObject();

  private _config = new BehaviorSubject<Maybe<DbNgxInjectedComponentConfig<T>>>(undefined);
  private _template = new BehaviorSubject<Maybe<DbNgxInjectedTemplateConfig<T>>>(undefined);

  private _content = new BehaviorSubject<Maybe<ViewContainerRef>>(undefined);
  private _componentRef = new BehaviorSubject<Maybe<ComponentRef<T>>>(undefined);

  readonly config$ = this._config.pipe(distinctUntilChanged(), throttleTime(200, undefined, { leading: true, trailing: true }));
  readonly template$ = this._template.pipe(distinctUntilChanged(), throttleTime(10, undefined, { leading: true, trailing: true }));
  readonly content$ = this._content.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  get config(): Maybe<DbNgxInjectedComponentConfig<T>> {
    return this._config.value;
  }

  set config(config: Maybe<DbNgxInjectedComponentConfig<T>>) {
    this._config.next(config);
  }

  get template(): Maybe<DbNgxInjectedTemplateConfig<T>> {
    return this._template.value;
  }

  set template(template: Maybe<DbNgxInjectedTemplateConfig<T>>) {
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
    this._subscriptionObject.subscription = combineLatest([this.config$, this.template$, this.content$]).subscribe(([config, template, content]) => {
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

  private _initComponent(config: DbNgxInjectedComponentConfig<T>, content: ViewContainerRef): void {
    content.clear();

    const { init, injector, componentClass } = config;

    const componentRef: ComponentRef<T> = content.createComponent(componentClass, { injector });

    const instance = componentRef.instance;

    if (init) {
      init(instance);
    }

    this.componentRef = componentRef;
  }

  private _initTemplate(config: DbNgxInjectedTemplateConfig<T>, content: ViewContainerRef): void {
    content.clear();

    const { templateRef, viewRef } = config;

    console.log('Render template: ', templateRef, config);

    if (templateRef) {
      const embeddedViewRef: EmbeddedViewRef<T> = content.createEmbeddedView(templateRef);

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
