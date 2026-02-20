import { Directive, Injector, OnDestroy, OnInit, Signal, effect, inject, input, runInInjectionContext } from '@angular/core';
import { IsEqualFunction, IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionValueGetterValueGetterFunction, DbxActionValueGetterInstance } from './action.value.trigger.instance';
import { clean } from '../../../rxjs/clean';

export interface DbxActionValueGetterDirectiveComputeInputsConfig<T> {
  readonly valueGetterSignal?: Signal<Maybe<DbxActionValueGetterValueGetterFunction<T>>>;
  readonly isModifiedSignal?: Signal<Maybe<IsModifiedFunction>>;
  readonly isEqualSignal?: Signal<Maybe<IsEqualFunction>>;
}

/**
 * Abstract class for directives that may perform an action when trigger is called, and returns a value.
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
 * Action directive that uses a getter function instead and waits for the trigger to be called before calling the function.
 *
 * Similar to DbxActionValueDirective, but the getter is called when a trigger is activated.
 * The DbxActionValueDirective always pipes the latests value while waiting for a trigger, and does not allow using a getter.
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
