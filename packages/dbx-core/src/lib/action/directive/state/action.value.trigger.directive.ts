import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { IsModifiedFunction, SubscriptionObject } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { DbxActionValueOnTriggerFunction, DbxActionValueOnTriggerInstance } from './action.value.trigger.instance';

/**
 * Abstract class for directives that may perform an action when trigger is called, and returns a value.
 */
@Directive()
export abstract class AbstractDbxActionValueOnTriggerDirective<T> implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, unknown>);

  private readonly _triggerInstance: DbxActionValueOnTriggerInstance<T> = new DbxActionValueOnTriggerInstance<T>({
    source: this.source
  });

  private _triggeredSub = new SubscriptionObject();

  get valueGetter(): Maybe<DbxActionValueOnTriggerFunction<T>> {
    return this._triggerInstance.valueGetter;
  }

  set valueGetter(valueGetter: Maybe<DbxActionValueOnTriggerFunction<T>>) {
    this._triggerInstance.valueGetter = valueGetter;
  }

  get isModifiedFunction(): Maybe<IsModifiedFunction<T>> {
    return this._triggerInstance.isModifiedFunction;
  }

  set isModifiedFunction(isModifiedFunction: Maybe<IsModifiedFunction<T>>) {
    this._triggerInstance.isModifiedFunction = isModifiedFunction;
  }

  ngOnInit(): void {
    this._triggerInstance.init();
  }

  ngOnDestroy(): void {
    this._triggerInstance.destroy();
    this._triggeredSub.destroy();
  }
}

/**
 * Action directive that is used to trigger/display a popover, then watches that popover for a value.
 */
@Directive({
  exportAs: 'dbxActionValueOnTrigger',
  selector: '[dbxActionValueOnTrigger]'
})
export class DbxActionValueTriggerDirective<T = object> extends AbstractDbxActionValueOnTriggerDirective<T> implements OnInit, OnDestroy {
  readonly elementRef = inject(ElementRef);

  @Input()
  set dbxActionValueOnTrigger(dbxActionValueTrigger: Maybe<DbxActionValueOnTriggerFunction<T>>) {
    this.valueGetter = dbxActionValueTrigger;
  }

  @Input()
  set dbxActionValueTriggerModified(isModifiedFunction: Maybe<IsModifiedFunction>) {
    this.isModifiedFunction = isModifiedFunction;
  }

  constructor() {
    super();
  }
}
