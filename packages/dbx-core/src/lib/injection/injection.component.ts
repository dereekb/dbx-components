import { Component, ViewContainerRef, input, viewChild, effect } from '@angular/core';
import { DbxInjectionComponentConfig, DbxInjectionTemplateConfig } from './injection';
import { AbstractDbxInjectionDirective } from './injection.directive';
import { type Maybe } from '@dereekb/util';
import { NgTemplateOutlet } from '@angular/common';
import { ObservableOrValueGetter } from '@dereekb/rxjs';

/**
 * Component that injects content based on the configuration into the view.
 */
@Component({
  selector: 'dbx-injection, [dbxInjection], [dbx-injection]',
  template: `
    <ng-template #content></ng-template>
  `,
  imports: [NgTemplateOutlet],
  standalone: true
})
export class DbxInjectionComponent<T> extends AbstractDbxInjectionDirective<T> {
  readonly content = viewChild('content', { read: ViewContainerRef });

  readonly config = input<Maybe<ObservableOrValueGetter<DbxInjectionComponentConfig<T>>>>();
  readonly template = input<Maybe<ObservableOrValueGetter<DbxInjectionTemplateConfig<T>>>>();

  protected readonly _contentEffect = effect(() => this.setContent(this.content()));
  protected readonly _configEffect = effect(() => this.setConfig(this.config()));
  protected readonly _templateEffect = effect(() => this.setTemplate(this.template()));
}
