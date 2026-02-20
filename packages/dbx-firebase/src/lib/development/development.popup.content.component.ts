import { ClickableAnchor, DbxActionAutoTriggerDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxAuthService, cleanSubscription, completeOnDestroy } from '@dereekb/dbx-core';
import { Component, computed, inject } from '@angular/core';
import { DbxAnchorComponent, DbxTwoBlockComponent, DbxTwoColumnComponent, DbxTwoColumnFullLeftDirective, DbxTwoColumnRightComponent, DbxWidgetDataPair, DbxWidgetViewComponent, TwoColumnsContextStore } from '@dereekb/dbx-web';
import { DevelopmentFirebaseFunctionSpecifier } from '@dereekb/firebase';
import { WorkUsingContext, IsModifiedFunction } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { first, BehaviorSubject, distinctUntilChanged, map, shareReplay, combineLatest, Observable } from 'rxjs';
import { DbxFirebaseDevelopmentWidgetService } from './development.widget.service';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { DbxFirebaseDevelopmentPopupContentFormComponent, DbxFirebaseDevelopmentPopupContentFormValue } from './development.popup.content.form.component';
import { msToSeconds } from '@dereekb/date';
import { DEVELOPMENT_FIREBASE_SERVER_SCHEDULER_WIDGET_KEY } from './development.scheduler.widget.component';
import { DbxFirebaseEmulatorService } from '../firebase/firebase.emulator.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'dbx-firebase-development-popup-content',
  templateUrl: './development.popup.content.component.html',
  styleUrls: ['./development.popup.component.scss'],
  imports: [DbxAnchorComponent, DbxTwoColumnFullLeftDirective, DbxWidgetViewComponent, DbxTwoColumnComponent, DbxTwoBlockComponent, DbxTwoColumnRightComponent, DbxWidgetViewComponent, DbxFirebaseDevelopmentPopupContentFormComponent, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionFormDirective, DbxFormSourceDirective, DbxActionAutoTriggerDirective, MatButtonModule],
  providers: [TwoColumnsContextStore],
  standalone: true
})
export class DbxFirebaseDevelopmentPopupContentComponent {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);
  readonly dbxAuthService = inject(DbxAuthService);
  readonly dbxFirebaseDevelopmentWidgetService = inject(DbxFirebaseDevelopmentWidgetService);
  readonly dbxFirebaseDevelopmentSchedulerService = inject(DbxFirebaseDevelopmentSchedulerService);
  readonly dbxFirebaseEmulatorService = inject(DbxFirebaseEmulatorService);

  readonly showEmulatorButton = this.dbxFirebaseEmulatorService.useEmulators === true;
  readonly emulatorUIAnchor: ClickableAnchor = this.dbxFirebaseEmulatorService.emulatorUIAnchor ?? {};

  readonly entries = this.dbxFirebaseDevelopmentWidgetService.getEntries();

  private readonly _activeEntrySelector = completeOnDestroy(new BehaviorSubject<Maybe<DevelopmentFirebaseFunctionSpecifier>>(DEVELOPMENT_FIREBASE_SERVER_SCHEDULER_WIDGET_KEY));

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
  readonly activeEntry$ = this.currentActiveEntry$.pipe(distinctUntilChanged(), shareReplay(1));

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

  readonly schedulerRunningSignal = toSignal(this.schedulerRunning$);
  readonly schedulerIntervalSignal = toSignal(this.schedulerInterval$);
  readonly schedulerErrorSignal = toSignal(this.schedulerError$);

  readonly activeEntrySignal = toSignal(this.activeEntry$);
  readonly rightTitleSignal = computed(() => this.activeEntrySignal()?.label);
  readonly widgetConfigSignal = computed<Maybe<DbxWidgetDataPair>>(() => {
    const widget = this.activeEntrySignal()?.widget;
    let widgetConfig: Maybe<DbxWidgetDataPair> = undefined;

    if (widget) {
      widgetConfig = { type: widget.type, data: undefined };
    }

    return widgetConfig;
  });

  constructor() {
    this.twoColumnsContextStore.setShowRight(this.showRight$);
    cleanSubscription(
      this.twoColumnsContextStore.back$.subscribe(() => {
        this.clearSelection();
      })
    );
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
