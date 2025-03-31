import { Directive, Injector, OnDestroy, OnInit, Signal, effect, inject, input, runInInjectionContext } from '@angular/core';
import { IsEqualFunction, IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionValueOnTriggerValueGetterFunction, DbxActionValueOnTriggerInstance } from './action.value.trigger.instance';

export interface DbxActionValueOnTriggerDirectiveComputeInputsConfig<T> {
  readonly dbxActionValueOnTriggerSignal?: Signal<Maybe<DbxActionValueOnTriggerValueGetterFunction<T>>>;
  readonly dbxActionValueOnTriggerIsModifiedSignal?: Signal<Maybe<IsModifiedFunction>>;
  readonly dbxActionValueOnTriggerIsEqualSignal?: Signal<Maybe<IsEqualFunction>>;
}

/**
 * Abstract class for directives that may perform an action when trigger is called, and returns a value.
 */
@Directive()
export abstract class AbstractDbxActionValueOnTriggerDirective<T> implements OnInit, OnDestroy {
  private readonly _injector = inject(Injector);

  readonly source = inject(DbxActionContextStoreSourceInstance<T, unknown>);

  private readonly _triggerInstance: DbxActionValueOnTriggerInstance<T> = new DbxActionValueOnTriggerInstance<T>({
    source: this.source
  });

  ngOnInit(): void {
    this._triggerInstance.init();
  }

  ngOnDestroy(): void {
    this._triggerInstance.destroy();
  }

  setValueGetterFunction(valueGetterFunction: Maybe<DbxActionValueOnTriggerValueGetterFunction<T>>) {
    this._triggerInstance.setValueGetterFunction(valueGetterFunction);
  }

  protected configureInputs(config: DbxActionValueOnTriggerDirectiveComputeInputsConfig<T>): void {
    runInInjectionContext(this._injector, () => {
      effect(() => {
        if (config?.dbxActionValueOnTriggerIsModifiedSignal != null) {
          const isModified = config?.dbxActionValueOnTriggerIsModifiedSignal();
          this._triggerInstance.setIsModifiedFunction(isModified);
        }

        if (config?.dbxActionValueOnTriggerIsEqualSignal != null) {
          const isEqual = config?.dbxActionValueOnTriggerIsEqualSignal();
          this._triggerInstance.setIsEqualFunction(isEqual);
        }

        if (config?.dbxActionValueOnTriggerSignal != null) {
          const trigger = config?.dbxActionValueOnTriggerSignal();
          this._triggerInstance.setValueGetterFunction(trigger);
        }
      });
    });
  }
}

/**
 * Action directive that is used to trigger/display a popover, then watches that popover for a value.
 */
@Directive({
  exportAs: 'dbxActionValueOnTrigger',
  selector: '[dbxActionValueOnTrigger]',
  standalone: true
})
export class DbxActionValueTriggerDirective<T = object> extends AbstractDbxActionValueOnTriggerDirective<T> implements OnDestroy {
  readonly dbxActionValueOnTrigger = input<Maybe<DbxActionValueOnTriggerValueGetterFunction<T>>>();
  readonly dbxActionValueOnTriggerIsModified = input<Maybe<IsModifiedFunction>>();
  readonly dbxActionValueOnTriggerIsEqual = input<Maybe<IsEqualFunction>>();

  constructor() {
    super();
    this.configureInputs({
      dbxActionValueOnTriggerSignal: this.dbxActionValueOnTrigger,
      dbxActionValueOnTriggerIsModifiedSignal: this.dbxActionValueOnTriggerIsModified,
      dbxActionValueOnTriggerIsEqualSignal: this.dbxActionValueOnTriggerIsEqual
    });
  }
}
