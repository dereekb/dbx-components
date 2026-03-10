import { filterMaybe } from '@dereekb/rxjs';
import { Directive, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { switchMap } from 'rxjs';
import { type SecondaryActionContextStoreSource, type ActionContextStoreSource, actionContextStoreSourcePipe } from '../../action.store.source';
import { provideSecondaryActionStoreSource } from '../../action.store.source.provide';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Directive that forwards an externally-provided {@link ActionContextStoreSource} as a
 * {@link SecondaryActionContextStoreSource}, enabling child `dbxAction` directives to
 * reuse an existing action context rather than creating their own.
 *
 * This is useful when an action context is created programmatically (e.g., via
 * {@link DbxActionContextMachine}) and needs to be shared with template-based directives.
 *
 * @example
 * ```html
 * <!-- Forward a programmatic action source to template directives -->
 * <div [dbxActionSource]="myActionSource">
 *   <div dbxAction>
 *     <button (click)="action.trigger()">Submit</button>
 *   </div>
 * </div>
 * ```
 *
 * @see {@link DbxActionDirective} for the directive that consumes this source.
 * @see {@link SecondaryActionContextStoreSource}
 */
@Directive({
  selector: '[dbxActionSource]',
  providers: provideSecondaryActionStoreSource(DbxActionSourceDirective),
  standalone: true
})
export class DbxActionSourceDirective implements SecondaryActionContextStoreSource {
  readonly dbxActionSource = input<Maybe<ActionContextStoreSource>>();

  readonly store$ = toObservable(this.dbxActionSource).pipe(
    filterMaybe(),
    switchMap((x) => actionContextStoreSourcePipe(x.store$))
  );
}
