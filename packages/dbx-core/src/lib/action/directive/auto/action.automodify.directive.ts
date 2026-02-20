import { Directive, OnInit, OnDestroy, inject, input } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../rxjs';
import { distinctUntilChanged, filter, switchMap, Observable, EMPTY } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { isNotFalse } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

@Directive({
  selector: 'dbxActionAutoModify, [dbxActionAutoModify]',
  standalone: true
})
export class DbxActionAutoModifyDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });
  readonly autoModifyEnabled = input<boolean, string | boolean>(true, { alias: 'dbxActionAutoModify', transform: isNotFalse });
  readonly markAsModified$: Observable<void> = toObservable(this.autoModifyEnabled).pipe(
    distinctUntilChanged(),
    switchMap((x) => {
      let obs: Observable<any>;

      if (x) {
        obs = this.source.isModified$.pipe(filter((x) => !x));
      } else {
        obs = EMPTY;
      }

      return obs;
    })
  );

  ngOnInit(): void {
    this.sub = this.markAsModified$.subscribe(() => {
      this.source.setIsModified(true);
    });
  }
}
