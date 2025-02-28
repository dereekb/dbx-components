import { filterMaybe } from '@dereekb/rxjs';
import { Directive, OnInit, OnDestroy, Input, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../subscription';
import { shareReplay, distinctUntilChanged, switchMap, tap, BehaviorSubject } from 'rxjs';
import { DbxButton } from '../button';
import { SegueRef, DbxRouterService } from '../../router';

// MARK: Button Directives
@Directive({
  selector: '[dbxButtonSegue]'
})
export class DbxButtonSegueDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly dbxButton = inject(DbxButton);
  readonly dbxRouterService = inject(DbxRouterService);

  private readonly _segueRef = new BehaviorSubject<Maybe<SegueRef>>(undefined);
  readonly segueRef$ = this._segueRef.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  @Input('dbxButtonSegue')
  get segueRef(): Maybe<SegueRef> {
    return this._segueRef.value;
  }

  set segueRef(segueRef: Maybe<SegueRef>) {
    this._segueRef.next(segueRef);
  }

  ngOnInit(): void {
    this.sub = this.segueRef$
      .pipe(
        switchMap((segueRef) =>
          this.dbxButton.clicked$.pipe(
            tap(() => {
              this.dbxRouterService.go(segueRef);
            })
          )
        )
      )
      .subscribe();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._segueRef.complete();
  }
}
