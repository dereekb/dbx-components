import { distinctUntilChanged } from 'rxjs/operators';
import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions } from '@ngx-formly/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFormEvent, DbxFormState } from '../form/form';
import { DbxFormlyContext, DbxFormlyContextDelegate } from './formly.context';
import { cloneDeep } from 'lodash';

@Component({
  selector: 'dbx-formly',
  exportAs: 'formly',
  template: `
    <form [formGroup]="form" class="dbx-formly">
      <formly-form [form]="form" [fields]="fields" [model]="model"></formly-form>
    </form>
  `,
  // TODO: styleUrls: ['./form.scss'],
})
export class DbxFormlyComponent<T extends object> extends AbstractSubscriptionDirective implements DbxFormlyContextDelegate<T>, OnInit, OnDestroy {

  private _changesCount = 0;
  private _lastResetAt?: Date;

  private _fields: FormlyFieldConfig[] = [];
  private _events = new BehaviorSubject<DbxFormEvent>({ isComplete: false, state: DbxFormState.INITIALIZING });

  form = new FormGroup({});
  model: any = {};
  options: FormlyFormOptions = {};

  constructor(private readonly context: DbxFormlyContext<T>, private readonly ngZone: NgZone) {
    super();
  }

  ngOnInit(): void {
    this.context.setDelegate(this);
    this.sub = this.form.valueChanges.pipe(
      startWith(this.form.value),
      distinctUntilChanged(),
      debounceTime(50)
    ).subscribe((_) => this._updateForChange());
  }

  override ngOnDestroy(): void {
    this.context.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this.context.clearDelegate(this);
      this._events.complete();
    });
  }

  get fields(): FormlyFieldConfig[] {
    return this._fields;
  }

  // MARK: Delegate
  get isComplete(): boolean {
    return this._events.value.isComplete;
  }

  get state(): DbxFormState {
    return this._events.value.state;
  }

  get stream$(): Observable<DbxFormEvent> {
    return this._events.asObservable();
  }

  setFields(fields: FormlyFieldConfig[]): void {
    this._fields = fields;
  }

  getValue(): T {
    return this.form.value; // this.model
  }

  setValue(value: T): void {
    /*
    if (value === this.model) {
      return; // Ignore the same value being set.
    }
    */

    this.model = cloneDeep(value) as T;

    if (this.options.updateInitialValue) {
      this.options.updateInitialValue();
      this.options.resetModel?.();
    }

    // Re-mark as untouched and pristine.
    this.form.markAsUntouched();
    this.form.markAsPristine();
    this._lastResetAt = new Date();
    this._changesCount = 0;

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

  isDisabled(): boolean {
    return this.form.disabled;
  }

  setDisabled(disabled = true): void {
    // console.log('setting disabled: ', disabled);
    if (disabled) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  // MARK: Update
  forceFormUpdate(): void {
    this._updateForChange();
  }

  private _updateForChange(): void {
    const complete = this.form.valid;

    this._changesCount += 1;

    const nextState: DbxFormEvent = {
      isComplete: complete,
      state: (complete) ? DbxFormState.COMPLETE : DbxFormState.INCOMPLETE,
      untouched: this.form.untouched,
      pristine: this.form.pristine,
      changesCount: this._changesCount,
      lastResetAt: this._lastResetAt
    };

    this._events.next(nextState);
  }

}
