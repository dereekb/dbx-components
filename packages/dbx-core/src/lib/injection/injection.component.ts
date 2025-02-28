import { Component, ViewChild, ViewContainerRef, Input } from '@angular/core';
import { DbxInjectionComponentConfig, DbxInjectionTemplateConfig } from './injection';
import { AbstractDbxInjectionDirective } from './injection.directive';
import { type Maybe } from '@dereekb/util';

/**
 * Component that injects content based on the configuration into the view.
 */
@Component({
  selector: 'dbx-injection, [dbxInjection], [dbx-injection]',
  template: `
    <ng-template #content></ng-template>
  `
})
export class DbxInjectionComponent<T> extends AbstractDbxInjectionDirective<T> {
  @Input()
  set config(config: Maybe<DbxInjectionComponentConfig<T>>) {
    this.setConfig(config);
  }

  @Input()
  set template(template: Maybe<DbxInjectionTemplateConfig<T>>) {
    this.setTemplate(template);
  }

  @ViewChild('content', { static: true, read: ViewContainerRef })
  set content(content: Maybe<ViewContainerRef>) {
    this.setContent(content);
  }
}
