import { filterMaybe } from '@dereekb/util-rxjs';
import { SegueRef } from '../../router/segue';
import { Directive, OnInit, OnDestroy, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../subscription';
import { shareReplay, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { DbNgxButton } from '@dereekb/ngx-core';
import { BehaviorSubject } from 'rxjs';
import { DbNgxRouterService } from '../../router/router.service';

// MARK: Button Directives
@Directive({
  selector: '[dbxButtonSegue]'
})
export class DbNgxButtonSegueDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _segueRef = new BehaviorSubject<Maybe<SegueRef>>(undefined);
  readonly segueRef$ = this._segueRef.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  @Input('dbxButtonSegue')
  get segueRef(): Maybe<SegueRef> {
    return this._segueRef.value;
  }

  set segueRef(segueRef: Maybe<SegueRef>) {
    this._segueRef.next(segueRef);
  }

  constructor(readonly dbxButton: DbNgxButton, readonly dbxRouterService: DbNgxRouterService) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.segueRef$.pipe(
      switchMap(segueRef => this.dbxButton.clicked$.pipe(
        tap(() => {
          this.dbxRouterService.go(segueRef);
        })
      ))
    ).subscribe();
  }

}
