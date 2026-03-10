import { Directive, Injector, type Signal, effect, inject, input, runInInjectionContext } from '@angular/core';
import { type IsEqualFunction, type IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { type DbxActionValueGetterValueGetterFunction, DbxActionValueGetterInstance } from './action.value.trigger.instance';
import { clean } from '../../../rxjs/clean';

/**
 * Configuration for connecting Angular signals to a {@link DbxActionValueGetterInstance}'s
 * value getter, isModified, and isEqual functions.
 *
 * @typeParam T - The value type for the action.
 */
export interface DbxActionValueGetterDirectiveComputeInputsConfig<T> {
  readonly valueGetterSignal?: Signal<Maybe<DbxActionValueGetterValueGetterFunction<T>>>;
  readonly isModifiedSignal?: Signal<Maybe<IsModifiedFunction>>;
  readonly isEqualSignal?: Signal<Maybe<IsEqualFunction>>;
}

/**
 * Abstract base class for directives that retrieve a value when the action is triggered.
 *
 * Creates and manages a {@link DbxActionValueGetterInstance} internally, providing
 * methods for subclasses to configure the value getter, isModified, and isEqual functions.
 *
 * @typeParam T - The value type for the action.
 *
 * @see {@link DbxActionValueTriggerDirective} for the concrete implementation.
 */
@Directive()
export abstract class AbstractDbxActionValueGetterDirective<T> {
  private readonly _injector = inject(Injector);

  readonly source = inject(DbxActionContextStoreSourceInstance<T, unknown>);

  private readonly _triggerInstance: DbxActionValueGetterInstance<T> = new DbxActionValueGetterInstance<T>({
    source: this.source
  });

  constructor() {
    this._triggerInstance.init();
    clean(this._triggerInstance);
  }

  setValueGetterFunction(valueGetterFunction: Maybe<DbxActionValueGetterValueGetterFunction<T>>) {
    this._triggerInstance.setValueGetterFunction(valueGetterFunction);
  }

  protected configureInputs(config: DbxActionValueGetterDirectiveComputeInputsConfig<T>): void {
    runInInjectionContext(this._injector, () => {
      effect(() => {
        if (config?.isModifiedSignal != null) {
          const isModified = config?.isModifiedSignal();
          this._triggerInstance.setIsModifiedFunction(isModified);
        }

        if (config?.isEqualSignal != null) {
          const isEqual = config?.isEqualSignal();
          this._triggerInstance.setIsEqualFunction(isEqual);
        }

        if (config?.valueGetterSignal != null) {
          const valueGetter = config?.valueGetterSignal();
          this._triggerInstance.setValueGetterFunction(valueGetter);
        }
      });
    });
  }
}

/**
 * Directive that uses a getter function to retrieve the action value only when triggered.
 *
 * Unlike {@link DbxActionValueDirective} which continuously pipes the latest value,
 * this directive calls the getter function lazily -- only when the action is triggered.
 * This is useful when the value computation is expensive or depends on state that should
 * only be captured at trigger time.
 *
 * Supports optional `isModified` and `isEqual` functions to control whether the retrieved
 * value should proceed to `readyValue` or be rejected.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container [dbxActionValueGetter]="getFormValue"></ng-container>
 *   <button (click)="action.trigger()">Submit</button>
 * </div>
 * ```
 *
 * @typeParam T - The value type for the action.
 *
 * @see {@link DbxActionValueDirective} for the always-available value approach.
 */
@Directive({
  exportAs: 'dbxActionValueGetter',
  selector: '[dbxActionValueGetter]',
  standalone: true
})
export class DbxActionValueTriggerDirective<T = object> extends AbstractDbxActionValueGetterDirective<T> {
  readonly dbxActionValueGetter = input<Maybe<DbxActionValueGetterValueGetterFunction<T>>>();
  readonly dbxActionValueGetterIsModified = input<Maybe<IsModifiedFunction>>();
  readonly dbxActionValueGetterIsEqual = input<Maybe<IsEqualFunction>>();

  constructor() {
    super();
    this.configureInputs({
      valueGetterSignal: this.dbxActionValueGetter,
      isModifiedSignal: this.dbxActionValueGetterIsModified,
      isEqualSignal: this.dbxActionValueGetterIsEqual
    });
  }
}
