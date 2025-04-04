import { toObservable } from '@angular/core/rxjs-interop';
import { Directive, OnInit, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { provideTwoColumnsContext, TwoColumnsContextStore } from './two.column.store';

/**
 * Provides a dbxTwoColumnContextStore
 */
@Directive({
  selector: '[dbxTwoColumnContext]',
  providers: provideTwoColumnsContext(),
  standalone: true
})
export class DbxTwoColumnContextDirective implements OnInit {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore, { self: true });
  readonly showRight = input<boolean, Maybe<boolean | ''>>(false, { transform: (x) => Boolean(x) });

  ngOnInit(): void {
    this.twoColumnsContextStore.setShowRight(toObservable(this.showRight));
  }
}
