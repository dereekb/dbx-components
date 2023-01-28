import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input, Directive } from '@angular/core';
import { AbstractDbxInjectionDirective } from '@dereekb/dbx-core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap } from 'rxjs';
import { DbxTableStore } from './table.store';
import { Maybe } from '@dereekb/util';

/**
 * Abstract directive that has an element input.
 */
@Directive()
export abstract class AbstractDbxTableElementComponent<T, C = unknown> implements OnDestroy {
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
