import { Directive } from "@angular/core";
import { IsModifiedFunction, SubscriptionObject } from "@dereekb/rxjs";
import { Maybe } from "@dereekb/util";
import { DbxActionContextStoreSourceInstance } from "../../action.store.source";
import { DbxActionValueOnTriggerFunction, DbxActionValueOnTriggerInstance } from "./action.value.trigger.instance";

/**
 * Abstract class for directives that may perform an action when trigger is called, and returns a value.
 */
@Directive()
export abstract class AbstractDbxActionValueOnTriggerDirective<T> {

  private readonly _instance: DbxActionValueOnTriggerInstance<T>;

  private _triggeredSub = new SubscriptionObject();

  constructor(
    readonly source: DbxActionContextStoreSourceInstance<T, any>,
    valueGetter?: Maybe<DbxActionValueOnTriggerFunction<T>>
  ) {
    this._instance = new DbxActionValueOnTriggerInstance<T>({
      source: this.source,
      valueGetter
    });
  }

  get valueGetter(): Maybe<DbxActionValueOnTriggerFunction<T>> {
    return this._instance.valueGetter;
  }

  set valueGetter(valueGetter: Maybe<DbxActionValueOnTriggerFunction<T>>) {
    this._instance.valueGetter = valueGetter;
  }

  get isModifiedFunction(): Maybe<IsModifiedFunction<T>> {
    return this._instance.isModifiedFunction;
  }

  set isModifiedFunction(isModifiedFunction: Maybe<IsModifiedFunction<T>>) {
    this._instance.isModifiedFunction = isModifiedFunction;
  }

  ngOnInit(): void {
    this._instance.init();
  }

  ngOnDestroy(): void {
    this._instance.destroy();
    this._triggeredSub.destroy();
  }

}
