import { ViewContainerRef, OnInit, OnDestroy, Directive, Injector } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxInjectedComponentConfig, DbxInjectedTemplateConfig } from './injected';
import { DbxInjectedComponentInstance } from './injected.instance';

/**
 * Abstract directive that injects content based on the configuration into the view.
 */
@Directive()
export abstract class AbstractDbxInjectedDirective<T> implements OnInit, OnDestroy {

  private _instance = new DbxInjectedComponentInstance<T>(this._injector);

  constructor(private readonly _injector: Injector) { }

  ngOnInit(): void {
    this._instance.init();
  }

  ngOnDestroy(): void {
    this._instance.destroy();
  }

  setConfig(config: Maybe<DbxInjectedComponentConfig>) {
    this._instance.config = config;
  }

  setTemplate(template: Maybe<DbxInjectedTemplateConfig>) {
    this._instance.template = template;
  }

  setContent(content: Maybe<ViewContainerRef>) {
    this._instance.content = content;
  }

}
