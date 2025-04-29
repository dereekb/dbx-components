import { Directive, inject, input } from '@angular/core';
import { AbstractIfDirective } from '@dereekb/dbx-core';
import { shareReplay, combineLatest, Observable, map } from 'rxjs';
import { DbxFirebaseCollectionChangeDirective } from './store.collection.change.directive';
import { IterationQueryDocChangeWatcherChangeType } from '@dereekb/firebase';
import { toObservable } from '@angular/core/rxjs-interop';

export type DbxFirebaseCollectionHasChangeDirectiveMode = 'all' | IterationQueryDocChangeWatcherChangeType;

/**
 * Structural directive that displays the content when the target change is detected.
 *
 * Can specify which changes to appear on.
 */
@Directive({
  selector: '[dbxFirebaseCollectionHasChange]',
  standalone: true
})
export class DbxFirebaseCollectionHasChangeDirective extends AbstractIfDirective {
  readonly directive = inject(DbxFirebaseCollectionChangeDirective);
  readonly mode = input<DbxFirebaseCollectionHasChangeDirectiveMode, DbxFirebaseCollectionHasChangeDirectiveMode | ''>('addedAndRemoved', { alias: 'dbxFirebaseCollectionHasChange', transform: (x) => x || 'addedAndRemoved' });

  readonly show$: Observable<boolean> = combineLatest([toObservable(this.mode), this.directive.event$]).pipe(
    map(([mode, event]) => {
      let show = false;

      if (event.type !== 'none') {
        switch (mode) {
          case 'all':
            show = true;
            break;
          case 'addedAndRemoved':
            show = event.type === 'addedAndRemoved' || event.type === 'added' || event.type === 'removed';
            break;
          default:
            show = event.type === mode;
            break;
        }
      }

      return show;
    }),
    shareReplay(1)
  );
}
