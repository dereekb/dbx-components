import { ViewContainerRef, OnInit, OnDestroy, Directive, Injector, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxInjectionComponentConfig, DbxInjectionTemplateConfig } from './injection';
import { DbxInjectionInstance as DbxInjectionInstance } from './injection.instance';
import { ObservableOrValueGetter } from '@dereekb/rxjs';

/**
 * Abstract directive that injects content based on the configuration into the view.
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

  setConfig(config: Maybe<ObservableOrValueGetter<DbxInjectionComponentConfig<T>>>) {
    this._instance.config = config;
  }

  setTemplate(template: Maybe<ObservableOrValueGetter<DbxInjectionTemplateConfig<T>>>) {
    this._instance.template = template;
  }

  setContent(content: Maybe<ViewContainerRef>) {
    this._instance.content = content;
  }
}
