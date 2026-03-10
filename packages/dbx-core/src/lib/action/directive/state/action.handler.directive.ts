import { Directive, effect, inject, input } from '@angular/core';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { type FactoryWithInput, type GetterOrValue, type Maybe } from '@dereekb/util';
import { DbxActionHandlerInstance } from './action.handler.instance';
import { type Work } from '@dereekb/rxjs';
import { clean } from '../../../rxjs';

/**
 * Abstract base directive that creates and manages a {@link DbxActionHandlerInstance} lifecycle.
 *
 * Subclasses configure how the handler function or value is provided to the instance.
 * The instance is initialized on construction and cleaned up automatically via the action's lock set.
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link DbxActionHandlerDirective} for the work-function variant.
 * @see {@link DbxActionHandlerValueDirective} for the value/getter variant.
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
 * Directive that provides a {@link Work} function to handle the action's `valueReady$` event.
 *
 * When the action is triggered and a value becomes ready, the provided work function is
 * called with the value and a work context. The work function is responsible for performing
 * the async operation and signaling success or failure through the context.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container [dbxActionHandler]="handleSave"></ng-container>
 *   <button (click)="action.trigger()">Save</button>
 * </div>
 * ```
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link DbxActionHandlerValueDirective} for the simpler value/getter variant.
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
 * Directive that provides a static value, getter, or factory to resolve the action's `valueReady$` event.
 *
 * Unlike {@link DbxActionHandlerDirective}, this does not require a full {@link Work} function.
 * The provided value (or the result of calling the getter/factory) is used directly as the
 * action's result, with the working/success lifecycle handled automatically.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container [dbxActionHandlerValue]="computeResult"></ng-container>
 *   <button (click)="action.trigger()">Compute</button>
 * </div>
 * ```
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link DbxActionHandlerDirective} for the full work-function variant.
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
