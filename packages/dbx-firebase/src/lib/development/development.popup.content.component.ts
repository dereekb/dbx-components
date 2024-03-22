import { ClickableAnchor, DbxAuthService } from '@dereekb/dbx-core';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { DbxWidgetDataPair, TwoColumnsContextStore } from '@dereekb/dbx-web';
import { DevelopmentFirebaseFunctionSpecifier } from '@dereekb/firebase';
import { WorkUsingObservable, WorkUsingContext, filterMaybe, IsModifiedFunction, SubscriptionObject } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { first, BehaviorSubject, distinctUntilChanged, map, shareReplay, combineLatest, Observable } from 'rxjs';
import { DbxFirebaseDevelopmentWidgetService } from './development.widget.service';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { DbxFirebaseDevelopmentPopupContentFormValue } from './development.popup.content.form.component';
import { msToSeconds } from '@dereekb/date';
import { DEVELOPMENT_FIREBASE_SERVER_SCHEDULER_WIDGET_KEY } from './development.scheduler.widget.component';
import { DbxFirebaseEmulatorService } from '../firebase';

@Component({
  selector: 'dbx-firebase-development-popup-content',
  templateUrl: './development.popup.content.component.html',
  styleUrls: ['./development.popup.component.scss'],
  providers: [TwoColumnsContextStore]
})
export class DbxFirebaseDevelopmentPopupContentComponent implements OnInit, OnDestroy {
  private readonly _backSub = new SubscriptionObject();

  readonly showEmulatorButton = this.dbxFirebaseEmulatorService.useEmulators === true;
  readonly emulatorUIAnchor: ClickableAnchor = this.dbxFirebaseEmulatorService.emulatorUIAnchor ?? {};

  readonly entries = this.dbxFirebaseDevelopmentWidgetService.getEntries();

  private _activeEntrySelector = new BehaviorSubject<Maybe<DevelopmentFirebaseFunctionSpecifier>>(DEVELOPMENT_FIREBASE_SERVER_SCHEDULER_WIDGET_KEY);

  readonly isLoggedIn$ = this.dbxAuthService.isLoggedIn$;

  readonly entries$ = this.isLoggedIn$.pipe(
    distinctUntilChanged(),
    map((isLoggedIn) => this.entries),
    shareReplay(1)
  );

  readonly formConfig$ = this.entries$.pipe(map((entries) => ({ entries })));
  readonly activeEntrySelector$ = this._activeEntrySelector.pipe(distinctUntilChanged());
  readonly currentActiveEntry$ = combineLatest([this.entries$, this.activeEntrySelector$]).pipe(
    map(([entries, selector]) => (selector ? entries.find((e) => e.widget.type === selector) : undefined)),
    shareReplay(1)
  );

  readonly showRight$ = this.currentActiveEntry$.pipe(map((x) => x != null));
  readonly activeEntry$ = this.currentActiveEntry$.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly rightTitle$ = this.activeEntry$.pipe(map((x) => x.label));
  readonly widgetConfig$: Observable<DbxWidgetDataPair> = this.activeEntry$.pipe(
    map((x) => ({ data: undefined, type: x.widget.type })),
    shareReplay(1)
  );

  readonly schedulerRunning$ = this.dbxFirebaseDevelopmentSchedulerService.running$;
  readonly schedulerInterval$ = this.dbxFirebaseDevelopmentSchedulerService.timerInterval$.pipe(
    map((x) => msToSeconds(x)),
    shareReplay(1)
  );
  readonly schedulerError$ = this.dbxFirebaseDevelopmentSchedulerService.error$.pipe(
    map((x) => (x ? 'Error Occured' : 'Ok')),
    shareReplay(1)
  );

  readonly formData$: Observable<DbxFirebaseDevelopmentPopupContentFormValue> = this._activeEntrySelector.pipe(
    distinctUntilChanged(),
    map((specifier) => ({ specifier }))
  );

  constructor(readonly twoColumnsContextStore: TwoColumnsContextStore, readonly dbxAuthService: DbxAuthService, readonly dbxFirebaseDevelopmentWidgetService: DbxFirebaseDevelopmentWidgetService, readonly dbxFirebaseDevelopmentSchedulerService: DbxFirebaseDevelopmentSchedulerService, readonly dbxFirebaseEmulatorService: DbxFirebaseEmulatorService) {}

  ngOnInit(): void {
    this.twoColumnsContextStore.setShowRight(this.showRight$);
    this._backSub.subscription = this.twoColumnsContextStore.back$.subscribe(() => {
      this.clearSelection();
    });
  }

  ngOnDestroy(): void {
    this._activeEntrySelector.complete();
  }

  readonly handleFormUpdate: WorkUsingContext<DbxFirebaseDevelopmentPopupContentFormValue, void> = (value, context) => {
    this._activeEntrySelector.next(value.specifier);
    context.success();
  };

  readonly isFormModified: IsModifiedFunction<DbxFirebaseDevelopmentPopupContentFormValue> = (value) => {
    return this._activeEntrySelector.pipe(
      map((currentSelector) => value.specifier !== currentSelector),
      first()
    );
  };

  clearSelection() {
    this._activeEntrySelector.next(undefined);
  }
}
