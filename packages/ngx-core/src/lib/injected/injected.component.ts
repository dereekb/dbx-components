import { Component, ComponentFactoryResolver, ComponentRef, ElementRef, Type, ViewChild, ViewContainerRef, OnInit, Input } from '@angular/core';
import { distinctUntilChanged, throttleTime } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { AbstractSubscriptionDirective } from '../util/subscription.directive';
import { DbNgxInjectedComponentConfig } from './injected';

/**
 * Component that injects content based on the configuration into the view.
 */
@Component({
  template: `<ng-template #content></ng-template>`,
  selector: 'dbngx-injected-content'
})
export class DbNgxInjectedComponent<T> extends AbstractSubscriptionDirective implements OnInit {

  private _config = new BehaviorSubject<DbNgxInjectedComponentConfig<T> | undefined>(undefined);

  @ViewChild('content', { static: true, read: ViewContainerRef })
  private _content?: ViewContainerRef;
  private _componentRef?: ComponentRef<T>;

  constructor(private resolver: ComponentFactoryResolver) {
    super();
  }

  @Input()
  get config(): DbNgxInjectedComponentConfig<T> | undefined {
    return this._config.value;
  }

  set config(config: DbNgxInjectedComponentConfig<T> | undefined) {
    this._config.next(config);
  }

  ngOnInit(): void {
    this.sub = this._config.pipe(distinctUntilChanged(), throttleTime(500, undefined, { leading: true, trailing: true })).subscribe((config) => {
      this._reset();

      if (config) {
        this._initComponent(config)
      }
    });
  }

  private _initComponent(config: DbNgxInjectedComponentConfig<T>): void {
    this._content!.clear();

    const { init, injector, componentClass } = config;

    const factory = this.resolver.resolveComponentFactory(componentClass);
    const componentRef: ComponentRef<T> = this._content!.createComponent(factory, undefined, injector);

    const instance = componentRef.instance;

    if (init) {
      init(instance);
    }

    this._componentRef = componentRef;
  }

  private _reset(): void {
    if (this._componentRef) {
      this._content!.clear();
      this._componentRef = undefined;
    }
  }

}
