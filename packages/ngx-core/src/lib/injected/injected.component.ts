import { Component, ComponentFactoryResolver, ComponentRef, ElementRef, Type, ViewChild, ViewContainerRef, OnInit, Input } from '@angular/core';
import { distinctUntilChanged, throttleTime } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { AbstractSubscriptionDirective } from '../subscription/subscription.directive';
import { DbNgxInjectedComponentConfig } from './injected';
import { DbNgxInjectedComponentInstance } from './injected.instance';
import { AbstractDbNgxInjectedDirective } from './injected.directive';
import { Maybe } from '@dereekb/util';

/**
 * Component that injects content based on the configuration into the view.
 */
@Component({
  template: `<ng-template #content></ng-template>`,
  selector: 'dbx-injected-content'
})
export class DbNgxInjectedComponent<T> extends AbstractDbNgxInjectedDirective<T> {

  @Input()
  set config(config: Maybe<DbNgxInjectedComponentConfig<T>>) {
    this.setConfig(config);
  }

  @ViewChild('content', { static: true, read: ViewContainerRef })
  set content(content: Maybe<ViewContainerRef>) {
    this.setContent(content);
  }

}
