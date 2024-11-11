import { Directive, Host, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { FactoryWithInput, GetterOrValue, Maybe } from '@dereekb/util';
import { DbxActionHandlerInstance } from './action.handler.instance';
import { Work } from '@dereekb/rxjs';

/**
 * Abstract directive that wraps and handles a DbxActionHandlerInstance lifecycle.
 */
@Directive()
export abstract class AbstractDbxActionHandlerDirective<T = unknown, O = unknown> implements OnInit, OnDestroy {
  readonly source: DbxActionContextStoreSourceInstance<T, O> = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });
  protected _dbxActionHandlerInstance = new DbxActionHandlerInstance<T, O>(this.source);

  ngOnInit(): void {
    this._dbxActionHandlerInstance.init();
  }

  ngOnDestroy(): void {
    this._dbxActionHandlerInstance.destroy();
  }
}

/**
 * Directive that wraps and controls a DbxActionHandlerInstance.
 */
@Directive({
  selector: '[dbxActionHandler]'
})
export class DbxActionHandlerDirective<T = unknown, O = unknown> extends AbstractDbxActionHandlerDirective<T, O> {
  @Input('dbxActionHandler')
  get handlerFunction(): Maybe<Work<T, O>> {
    return this._dbxActionHandlerInstance.handlerFunction;
  }

  set handlerFunction(handlerFunction: Maybe<Work<T, O>>) {
    this._dbxActionHandlerInstance.handlerFunction = handlerFunction;
  }
}

/**
 * Directive that passes
 */
@Directive({
  selector: '[dbxActionHandlerValue]'
})
export class DbxActionHandlerValueDirective<T = unknown, O = unknown> extends AbstractDbxActionHandlerDirective<T, O> {
  @Input('dbxActionHandlerValue')
  get handlerValue(): Maybe<GetterOrValue<O> | FactoryWithInput<O, T>> {
    return this._dbxActionHandlerInstance.handlerValue;
  }

  set handlerValue(handlerValue: Maybe<GetterOrValue<O> | FactoryWithInput<O, T>>) {
    this._dbxActionHandlerInstance.handlerValue = handlerValue;
  }

  override ngOnInit(): void {
    super.ngOnInit();

    if (this.handlerValue === undefined) {
      this.handlerValue = null; // pass a default null value
    }
  }
}
