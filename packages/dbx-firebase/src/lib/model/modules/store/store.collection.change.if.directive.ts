import { OnDestroy, TemplateRef, ViewContainerRef, Directive, Input } from '@angular/core';
import { AbstractIfDirective } from '@dereekb/dbx-core';
import { shareReplay, BehaviorSubject, combineLatest, Observable, map } from 'rxjs';
import { DbxFirebaseCollectionChangeDirective } from './store.collection.change.directive';
import { IterationQueryDocChangeWatcherChangeType } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';

export type DbxFirebaseCollectionHasChangeDirectiveMode = 'all' | IterationQueryDocChangeWatcherChangeType;

/**
 * Structural directive that displays the content when the target change is detected.
 *
 * Can specify which changes to appear on.
 */
@Directive({
  selector: '[dbxFirebaseCollectionHasChange]'
})
export class DbxFirebaseCollectionHasChangeDirective extends AbstractIfDirective implements OnDestroy {
  private _mode = new BehaviorSubject<DbxFirebaseCollectionHasChangeDirectiveMode>('addedAndRemoved');

  readonly show$: Observable<boolean> = combineLatest([this._mode, this.directive.event$]).pipe(
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

  constructor(templateRef: TemplateRef<unknown>, viewContainer: ViewContainerRef, public readonly directive: DbxFirebaseCollectionChangeDirective<unknown>) {
    super(templateRef, viewContainer);
  }

  @Input('dbxFirebaseCollectionHasChange')
  get mode(): DbxFirebaseCollectionHasChangeDirectiveMode {
    return this._mode.value;
  }

  set mode(mode: Maybe<DbxFirebaseCollectionHasChangeDirectiveMode | ''>) {
    this._mode.next(mode || 'addedAndRemoved');
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._mode.complete();
  }
}
