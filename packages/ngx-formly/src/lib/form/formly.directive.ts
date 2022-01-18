import { SubscriptionObject } from '@gae-web/appengine-utility';
import { Observable, BehaviorSubject } from 'rxjs';
import { AbstractSubscriptionDirective } from '@/app/common/utility';
import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { OnInit, OnDestroy, Directive, Input } from '@angular/core';
import { DbNgxFormlyContext } from './formly.context';

/**
 * Abstract component for wrapping a form.
 */
@Directive()
export abstract class AbstractFormlyFormDirective<T> implements OnDestroy {

  @Input()
  get disabled(): boolean {
    return this.context.isDisabled();
  }

  set disabled(disabled: boolean) {
    this.context.setDisabled(disabled);
  }

  constructor(public readonly context: DbNgxFormlyContext<T>) { }

  ngOnDestroy(): void {
    this.context.destroy();
  }

  // Utility Functions
  getValue(): T {
    return this.context.value;
  }

  setValue(value: Partial<T>): void {
    this.context.setValue(value);
  }

  clearValue(): void {
    this.setValue({});
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

  readonly fields$: Observable<FormlyFieldConfig[]>;

  private _fieldsSub = new SubscriptionObject();

  ngOnInit(): void {
    this._fieldsSub.subscription = this.fields$.subscribe((fields) => {
      this.context.fields = fields;
    });
  }

  ngOnDestroy(): void {
    this._fieldsSub.destroy();
    super.ngOnDestroy();
  }

}

@Directive()
export abstract class AbstractConfigAsyncFormlyFormDirective<T, C> extends AbstractAsyncFormlyFormDirective<T> {

  private readonly _config = new BehaviorSubject<C>(undefined);

  readonly config$ = this._config.asObservable();

  @Input()
  get config(): C {
    return this._config.value;
  }

  set config(config: C) {
    this._config.next(config);
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this._config.complete();
  }

}
