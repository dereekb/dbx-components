import { Directive, Host, Input, OnDestroy, OnInit } from '@angular/core';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { HandleActionWithFunctionOrContext } from '../../action.handler';
import { Maybe } from '@dereekb/util';
import { DbxActionHandlerInstance } from './action.handler.instance';

/**
 * Abstract directive that wraps and handles a DbxActionHandlerInstance lifecycle.
 */
@Directive()
export abstract class AbstractDbxActionHandlerDirective<T = unknown, O = unknown> implements OnInit, OnDestroy {
  protected _dbxActionHandlerInstance = new DbxActionHandlerInstance<T, O>(this.source);

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>) {}

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
  get handlerFunction(): Maybe<HandleActionWithFunctionOrContext<T, O>> {
    return this._dbxActionHandlerInstance.handlerFunction;
  }

  set handlerFunction(handlerFunction: Maybe<HandleActionWithFunctionOrContext<T, O>>) {
    this._dbxActionHandlerInstance.handlerFunction = handlerFunction;
  }
}
