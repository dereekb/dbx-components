import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { distinctUntilChanged, map, throttleTime, startWith, BehaviorSubject, Observable, Subject, switchMap, shareReplay, of } from 'rxjs';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxForm, DbxFormEvent, DbxFormState, ProvideDbxMutableForm } from '../form/form';
import { DbxFormlyContext, DbxFormlyContextDelegate, DbxFormlyInitialize } from './formly.context';
import { cloneDeep } from 'lodash';
import { scanCount, switchMapMaybeObs } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

/**
 * Used for rending a form from a DbxFormlyContext.
 */
@Component({
  selector: 'dbx-formly',
  exportAs: 'formly',
  template: `
    <form [formGroup]="form" class="dbx-formly">
      <formly-form [form]="form" [fields]="(fields$ | async) ?? []" [model]="model"></formly-form>
    </form>
  `,
  providers: ProvideDbxMutableForm(DbxFormlyFormComponent),
  host: {
    'class': 'dbx-formly'
  }
})
export class DbxFormlyFormComponent<T extends object> extends AbstractSubscriptionDirective implements DbxForm, DbxFormlyContextDelegate<T>, OnInit, OnDestroy {

  private _fields = new BehaviorSubject<Maybe<Observable<FormlyFieldConfig[]>>>(undefined);
  private _events = new BehaviorSubject<DbxFormEvent>({ isComplete: false, state: DbxFormState.INITIALIZING });

  private _reset = new BehaviorSubject<Date>(new Date());
  private _forceUpdate = new Subject<void>();

  form = new FormGroup({});
  model: any = {};
  options: FormlyFormOptions = {};

  readonly fields$ = this._fields.pipe(switchMapMaybeObs(), distinctUntilChanged(), shareReplay(1));

  readonly stream$: Observable<DbxFormEvent> = this._reset.pipe(
    switchMap((lastResetAt) => this.form.valueChanges.pipe(
      startWith(0),
      distinctUntilChanged(),
      throttleTime(50, undefined, { leading: true, trailing: true }),
      scanCount(),
      map((changesSinceLastResetCount: number) => {
        const isReset = changesSinceLastResetCount === 1;
        const complete = this.form.valid;

        const nextState: DbxFormEvent = {
          isComplete: complete,
          state: (isReset) ? DbxFormState.RESET : DbxFormState.USED,
          untouched: this.form.untouched,
          pristine: this.form.pristine,
          changesCount: changesSinceLastResetCount,
          lastResetAt,
          isDisabled: this.disabled
        };

        return nextState;
      })
    )),
    shareReplay(1)
  );

  constructor(private readonly context: DbxFormlyContext<T>) {
    super();
  }

  ngOnInit(): void {
    this.context.setDelegate(this);
  }

  override ngOnDestroy(): void {
    this.context.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this.context.clearDelegate(this);
      this._events.complete();
      this._fields.complete();
      this._reset.complete();
      this._forceUpdate.complete();
    });
  }

  // MARK: Delegate
  init(initialize: DbxFormlyInitialize<T>): void {
    this._fields.next(initialize.fields);
  }

  getValue(): Observable<T> {
    return of(this.form.value);
  }

  setValue(value: T): void {
    // console.log('set value: ', value);
    this.model = cloneDeep(value) as T;

    if (this.options.updateInitialValue) {
      this.options.updateInitialValue();
      this.options.resetModel?.();
    }

    // Re-mark as untouched and pristine.
    this.form.markAsUntouched();
    this.form.markAsPristine();

    // After updating the value, if the form is still untouched mark it as pristine again.
    // Sometimes the values get marked as changed and break pristine before a user has time to interact.
    setTimeout(() => {
      if (this.form.untouched) {
        this.form.markAsPristine();
      }
    }, 500);
  }

  resetForm(): void {
    if (this.options.resetModel) {
      this.options.resetModel();
    }
  }

  get disabled(): boolean {
    return this.form.disabled;
  }

  setDisabled(disabled = true): void {
    if (disabled !== this.disabled) {
      if (disabled) {
        this.form.disable({ emitEvent: true });
      } else {
        this.form.enable({ emitEvent: true });
      }
    }
  }

  // MARK: Update
  forceFormUpdate(): void {
    this._forceUpdate.next();
  }

}
