import { Directive, OnDestroy, effect, inject, input } from '@angular/core';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { FactoryWithInput, GetterOrValue, type Maybe } from '@dereekb/util';
import { DbxActionHandlerInstance } from './action.handler.instance';
import { Work } from '@dereekb/rxjs';
import { clean } from '../../../rxjs';

/**
 * Abstract directive that wraps and handles a DbxActionHandlerInstance lifecycle.
 */
@Directive()
export abstract class AbstractDbxActionHandlerDirective<T = unknown, O = unknown> {
  readonly source: DbxActionContextStoreSourceInstance<T, O> = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  protected readonly _dbxActionHandlerInstance = clean(new DbxActionHandlerInstance<T, O>(this.source));

  constructor() {
    this._dbxActionHandlerInstance.init();
  }
}

/**
 * Directive that passes a Work function to handle a valueReady$ event from an action context.
 */
@Directive({
  selector: '[dbxActionHandler]',
  standalone: true
})
export class DbxActionHandlerDirective<T = unknown, O = unknown> extends AbstractDbxActionHandlerDirective<T, O> {
  readonly handlerFunction = input.required<Maybe<Work<T, O>>>({ alias: 'dbxActionHandler' });

  protected readonly _handlerFunctionEffect = effect(() => {
    this._dbxActionHandlerInstance.setHandlerFunction(this.handlerFunction());
  });
}

/**
 * Directive that passes a value to handle a valueReady$ event from an action context.
 */
@Directive({
  selector: '[dbxActionHandlerValue]',
  standalone: true
})
export class DbxActionHandlerValueDirective<T = unknown, O = unknown> extends AbstractDbxActionHandlerDirective<T, O> {
  readonly handlerValue = input.required<Maybe<GetterOrValue<O> | FactoryWithInput<O, T>>>({ alias: 'dbxActionHandlerValue' });
  protected readonly _handlerValueEffect = effect(() => {
    this._dbxActionHandlerInstance.setHandlerValue(this.handlerValue());
  });
}
