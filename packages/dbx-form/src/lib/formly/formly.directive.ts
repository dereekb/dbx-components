import { SubscriptionObject, filterMaybe } from '@dereekb/rxjs';
import { Observable, BehaviorSubject, shareReplay, distinctUntilChanged } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { OnInit, OnDestroy, Directive, Input, inject, input, effect } from '@angular/core';
import { DbxFormlyContext } from './formly.context';
import { type Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxFormDisabledKey } from '../form/form';

/**
 * Abstract component for wrapping a DbxFormlyContext.
 *
 * The implementing component should use provideFormlyContext() to provide the DbxFormlyContext specific to this directive. The context is injected using only self.
 */
@Directive()
export abstract class AbstractFormlyFormDirective<T> implements OnDestroy {
  readonly context = inject(DbxFormlyContext<T>, { self: true });

  readonly disabled = input<boolean>(false);
  private readonly _setDisabledOnContext = effect(() => this.context.setDisabled(undefined, this.disabled()));

  ngOnDestroy(): void {
    this._setDisabledOnContext.destroy();
  }

  // Utility Functions
  getValue(): Observable<T> {
    return this.context.getValue();
  }

  setValue(value: Partial<T>): void {
    this.context.setValue(value);
  }

  resetForm(): void {
    this.context.resetForm();
  }

  clearValue(): void {
    this.setValue({});
  }

  setDisabled(key?: DbxFormDisabledKey, disabled?: boolean): void {
    this.context.setDisabled(key, disabled);
  }
}

/**
 * Abstract component for wrapping a form.
 */
@Directive()
export abstract class AbstractSyncFormlyFormDirective<T> extends AbstractFormlyFormDirective<T> implements OnInit, OnDestroy {
  abstract fields: FormlyFieldConfig[];

  ngOnInit(): void {
    this.context.fields = this.fields;
  }
}

/**
 * Abstract component for wrapping an asyncrhronously-configured form.
 */
@Directive()
export abstract class AbstractAsyncFormlyFormDirective<T> extends AbstractFormlyFormDirective<T> implements OnInit, OnDestroy {
  /**
   * Used to provide fields to the context.
   */
  abstract readonly fields$: Observable<Maybe<FormlyFieldConfig[]>>;

  private readonly _fieldsSub = new SubscriptionObject();

  ngOnInit(): void {
    this._fieldsSub.subscription = this.fields$.pipe(distinctUntilChanged()).subscribe((fields) => {
      this.context.fields = fields;
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._fieldsSub.destroy();
  }
}

@Directive()
export abstract class AbstractConfigAsyncFormlyFormDirective<T, C> extends AbstractAsyncFormlyFormDirective<T> implements OnInit, OnDestroy {
  readonly config = input<Maybe<C>>(undefined);

  readonly currentConfig$ = toObservable(this.config);
  readonly config$ = this.currentConfig$.pipe(filterMaybe(), shareReplay(1));
}
