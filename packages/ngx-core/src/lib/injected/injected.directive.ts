import { ViewContainerRef, OnInit, Input, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbNgxInjectedComponentConfig } from './injected';
import { DbNgxInjectedComponentInstance } from './injected.instance';

/**
 * Abstract directive that injects content based on the configuration into the view.
 */
export abstract class AbstractDbNgxInjectedDirective<T> implements OnInit, OnDestroy {

  private _instance = new DbNgxInjectedComponentInstance<T>();

  ngOnInit(): void {
    this._instance.init();
  }

  ngOnDestroy(): void {
    this._instance.destroy();
  }

  setConfig(config: Maybe<DbNgxInjectedComponentConfig>) {
    this._instance.config = config;
  }

  setContent(content: Maybe<ViewContainerRef>) {
    this._instance.content = content;
  }

}
