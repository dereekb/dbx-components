import { SubscriptionObject, filterMaybe } from '@dereekb/rxjs';
import { Observable, BehaviorSubject, shareReplay, distinctUntilChanged } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { OnInit, OnDestroy, Directive, Input, inject } from '@angular/core';
import { DbxFormlyContext } from './formly.context';
import { type Maybe } from '@dereekb/util';
import { DbxFormDisabledKey } from '../form/form';

/**
 * Abstract component for wrapping a form.
 */
@Directive()
export abstract class AbstractFormlyFormDirective<T> implements OnDestroy {
  readonly context = inject(DbxFormlyContext<T>);

  @Input()
  get disabled(): boolean {
    return this.context.isDisabled();
  }

  set disabled(disabled: boolean) {
    this.context.setDisabled(undefined, disabled);
  }

  ngOnDestroy(): void {
    this.context.destroy();
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

  private _fieldsSub = new SubscriptionObject();

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
  private readonly _config = new BehaviorSubject<Maybe<C>>(undefined);

  readonly currentConfig$ = this._config.asObservable();
  readonly config$ = this._config.pipe(filterMaybe(), shareReplay(1));

  @Input()
  get config(): Maybe<C> {
    return this._config.value;
  }

  set config(config: Maybe<C>) {
    this._config.next(config);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._config.complete();
  }
}
