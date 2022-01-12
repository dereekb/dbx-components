import { Initialized } from './../../../../util/src/lib/lifecycle';
import { Destroyable } from '../../../../util/src/lib/lifecycle';
import { Component, ComponentFactoryResolver, ComponentRef, ElementRef, Type, ViewChild, ViewContainerRef, OnInit, Input } from '@angular/core';
import { distinctUntilChanged, throttleTime, shareReplay } from 'rxjs/operators';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { DbNgxInjectedComponentConfig } from './injected';
import { Maybe } from '@dereekb/util';
import { filterMaybe } from '@dereekb/util-rxjs';
import { SubscriptionObject } from '../subscription';

/**
 * Instance used by components to inject content based on the configuration into the view.
 */
export class DbNgxInjectedComponentInstance<T> implements Initialized, Destroyable {

  private _subscriptionObject = new SubscriptionObject();

  private _config = new BehaviorSubject<Maybe<DbNgxInjectedComponentConfig<T>>>(undefined);
  private _content = new BehaviorSubject<Maybe<ViewContainerRef>>(undefined);
  private _componentRef = new BehaviorSubject<Maybe<ComponentRef<T>>>(undefined);

  readonly config$ = this._config.pipe(distinctUntilChanged(), throttleTime(200, undefined, { leading: true, trailing: true }));
  readonly content$ = this._content.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  get config(): Maybe<DbNgxInjectedComponentConfig<T>> {
    return this._config.value;
  }

  set config(config: Maybe<DbNgxInjectedComponentConfig<T>>) {
    this._config.next(config);
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
    this._subscriptionObject.subscription = combineLatest([this.config$, this.content$]).subscribe(([config, content]) => {
      this._reset(content);

      if (config) {
        this._initComponent(config, content)
      }
    });
  }

  destroy(): void {
    this._config.complete();
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

  private _reset(content: ViewContainerRef): void {
    if (this.componentRef) {
      content.clear();
      this.componentRef = undefined;
    }
  }

}
