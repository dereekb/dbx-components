import { Component, ViewChild, ViewContainerRef, Input } from '@angular/core';
import { DbNgxInjectedComponentConfig, DbNgxInjectedTemplateConfig } from './injected';
import { AbstractDbNgxInjectedDirective } from './injected.directive';
import { Maybe } from '@dereekb/util';

/**
 * Component that injects content based on the configuration into the view.
 */
@Component({
  selector: 'dbx-injected-content, [dbx-injected-content]',
  template: `<ng-template #content></ng-template>`
})
export class DbNgxInjectedComponent<T> extends AbstractDbNgxInjectedDirective<T> {

  @Input()
  set config(config: Maybe<DbNgxInjectedComponentConfig<T>>) {
    this.setConfig(config);
  }

  @Input()
  set template(template: Maybe<DbNgxInjectedTemplateConfig<T>>) {
    this.setTemplate(template);
  }

  @ViewChild('content', { static: true, read: ViewContainerRef })
  set content(content: Maybe<ViewContainerRef>) {
    this.setContent(content);
  }

}
