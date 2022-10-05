import { DbxAuthService } from '@dereekb/dbx-core';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { DbxWidgetDataPair, TwoColumnsContextStore } from '@dereekb/dbx-web';
import { DevelopmentFirebaseFunctionSpecifier } from '@dereekb/firebase';
import { filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject, distinctUntilChanged, map, shareReplay, combineLatest, Observable } from 'rxjs';
import { DbxFirebaseDevelopmentWidgetService } from './development.widget.service';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';

@Component({
  selector: 'dbx-firebase-development-popup-content',
  templateUrl: './development.popup.content.component.html',
  styleUrls: ['./development.popup.component.scss'],
  providers: [TwoColumnsContextStore]
})
export class DbxFirebaseDevelopmentPopupContentComponent implements OnInit, OnDestroy {
  private readonly _backSub = new SubscriptionObject();

  readonly entries = this.dbxFirebaseDevelopmentWidgetService.getEntries();

  private _activeEntrySelector = new BehaviorSubject<Maybe<DevelopmentFirebaseFunctionSpecifier>>(undefined);

  readonly isLoggedIn$ = this.dbxAuthService.isLoggedIn$;

  readonly entries$ = this.isLoggedIn$.pipe(
    distinctUntilChanged(),
    map((isLoggedIn) => {
      let entries = this.entries;

      if (!isLoggedIn) {
        entries = this.entries.filter((x) => x.auth === true);
      }

      return entries;
    }),
    shareReplay(1)
  );

  readonly formConfig$ = this.entries$.pipe(map((entries) => ({ entries })));
  readonly activeEntrySelector$ = this._activeEntrySelector.pipe(distinctUntilChanged());
  readonly currentActiveEntry$ = combineLatest([this.entries$, this.activeEntrySelector$]).pipe(
    map(([entries, selector]) => (selector ? entries.find((e) => e.widget.type === selector) : undefined)),
    shareReplay(1)
  );

  readonly showRight$ = this.currentActiveEntry$.pipe(map((x) => x != null));
  readonly activeEntry$ = this.currentActiveEntry$.pipe(filterMaybe(), shareReplay(1));

  readonly rightTitle$ = this.activeEntry$.pipe(map((x) => x.label));
  readonly widgetConfig$: Observable<DbxWidgetDataPair> = this.activeEntry$.pipe(map((x) => ({ data: undefined, type: x.widget.type })));

  readonly schedulerEnabled$ = this.dbxFirebaseDevelopmentSchedulerService.enabled$;

  constructor(readonly twoColumnsContextStore: TwoColumnsContextStore, readonly dbxAuthService: DbxAuthService, readonly dbxFirebaseDevelopmentWidgetService: DbxFirebaseDevelopmentWidgetService, readonly dbxFirebaseDevelopmentSchedulerService: DbxFirebaseDevelopmentSchedulerService) {}

  ngOnInit(): void {
    this.twoColumnsContextStore.setShowRight(this.showRight$);
    this._backSub.subscription = this.twoColumnsContextStore.back$.subscribe(() => {
      this.clearSelection();
    });
  }

  ngOnDestroy(): void {
    this._activeEntrySelector.complete();
  }

  clearSelection() {
    this._activeEntrySelector.next(undefined);
  }
}
