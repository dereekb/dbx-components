import { FormlyFieldConfig } from '@ngx-formly/core';
import { Directive, input } from '@angular/core';
import { provideFormlyContext } from './formly.context';
import { AbstractAsyncFormlyFormDirective } from './formly.directive';
import { type Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Provides an DbxFormlyContext and has an input for fields.
 */
@Directive({
  selector: '[dbxFormlyFields]',
  providers: provideFormlyContext(),
  standalone: true
})
export class DbxFormlyFieldsContextDirective<T = unknown> extends AbstractAsyncFormlyFormDirective<T> {
  readonly fields = input<Maybe<FormlyFieldConfig[]>>(undefined, { alias: 'dbxFormlyFields' });
  readonly fields$ = toObservable(this.fields);
}
