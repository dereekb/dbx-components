import { Component, ViewChild, ViewContainerRef, Input } from '@angular/core';
import { DbxInjectedComponentConfig, DbxInjectedTemplateConfig } from './injected';
import { AbstractDbxInjectedDirective } from './injected.directive';
import { Maybe } from '@dereekb/util';

/**
 * Component that injects content based on the configuration into the view.
 */
@Component({
  selector: 'dbx-injected-content, [dbxInjectedContext], [dbx-injected-content]',
  template: `<ng-template #content></ng-template>`
})
export class DbxInjectedComponent<T> extends AbstractDbxInjectedDirective<T> {

  @Input()
  set config(config: Maybe<DbxInjectedComponentConfig<T>>) {
    this.setConfig(config);
  }

  @Input()
  set template(template: Maybe<DbxInjectedTemplateConfig<T>>) {
    this.setTemplate(template);
  }

  @ViewChild('content', { static: true, read: ViewContainerRef })
  set content(content: Maybe<ViewContainerRef>) {
    this.setContent(content);
  }

}
