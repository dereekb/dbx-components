import { FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject } from 'rxjs';
import { Directive, OnDestroy, Input } from '@angular/core';
import { provideFormlyContext } from './formly.context';
import { AbstractAsyncFormlyFormDirective } from './formly.directive';
import { Maybe } from '@dereekb/util';

/**
 * Provides an DbxFormlyContext and has an input for fields.
 */
@Directive({
  selector: '[dbxFormlyFields]',
  providers: provideFormlyContext()
})
export class DbxFormlyFieldsContextDirective<T = unknown> extends AbstractAsyncFormlyFormDirective<T> implements OnDestroy {
  private _fields = new BehaviorSubject<Maybe<FormlyFieldConfig[]>>(undefined);
  readonly fields$ = this._fields.asObservable();

  @Input('dbxFormlyFields')
  get fields(): Maybe<FormlyFieldConfig[]> {
    return this._fields.value;
  }

  set fields(fields: Maybe<FormlyFieldConfig[]>) {
    this._fields.next(fields);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._fields.complete();
  }
}
