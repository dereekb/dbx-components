import { filterMaybe } from '@dereekb/rxjs';
import { OnDestroy, Input, Directive } from '@angular/core';
import { distinctUntilChanged, BehaviorSubject } from 'rxjs';
import { DbxTableStore } from './table.store';
import { Maybe } from '@dereekb/util';

/**
 * Abstract directive that has an element input.
 */
@Directive()
export abstract class AbstractDbxTableElementDirective<T, C = unknown> implements OnDestroy {
  private readonly _element = new BehaviorSubject<Maybe<T>>(undefined);
  readonly element$ = this._element.pipe(filterMaybe(), distinctUntilChanged());

  constructor(readonly tableStore: DbxTableStore<unknown, C, T>) {}

  @Input()
  set element(element: Maybe<T>) {
    this._element.next(element);
  }

  ngOnDestroy(): void {
    this._element.complete();
  }
}
