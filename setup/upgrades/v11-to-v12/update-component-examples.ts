//// ========== DbxAnchorComponent ==========
// === Before ===
import { skipFirstMaybe } from '@dereekb/rxjs';
import { Input, Component, TemplateRef, ViewChild, OnDestroy, HostListener, inject } from '@angular/core';
import { AbstractDbxAnchorDirective, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { map, distinctUntilChanged, shareReplay, BehaviorSubject } from 'rxjs';
import { DbxRouterWebProviderConfig } from '../../provider/router.provider.config';

@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  template: `
    <ng-container [ngSwitch]="type$ | async">
      <!-- Plain -->
      <ng-container *ngSwitchCase="0">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </ng-container>
      <!-- Click -->
      <a class="dbx-anchor-a dbx-anchor-click" [ngClass]="(selectedClass$ | async) || ''" (click)="clickAnchor()" *ngSwitchCase="1">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
      <!-- Router -->
      <dbx-injection [config]="srefAnchorConfig" *ngSwitchCase="2">
        <!-- Injected in child. -->
      </dbx-injection>
      <!-- Href -->
      <a class="dbx-anchor-a dbx-anchor-href" [href]="url$ | async" [attr.target]="target$ | async" *ngSwitchCase="3">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
      <!-- Disabled or None -->
      <a class="dbx-anchor-a dbx-anchor-disabled" *ngSwitchDefault>
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
    </ng-container>
    <ng-container *ngIf="block">
      <p>block example</p>
    </ng-container>
    <!-- Template content -->
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  host: {
    class: 'd-inline dbx-anchor',
    'dbx-anchor-block': 'block'
  }
})
export class DbxAnchorComponent extends AbstractDbxAnchorDirective implements OnDestroy {
  private readonly dbNgxRouterWebProviderConfig = inject(DbxRouterWebProviderConfig);

  private readonly _templateRef = new BehaviorSubject<Maybe<TemplateRef<unknown>>>(undefined);
  readonly templateRef$ = this._templateRef.pipe(skipFirstMaybe(), shareReplay(1));

  @Input()
  public block?: boolean;

  @ViewChild('content', { read: TemplateRef })
  get templateRef(): Maybe<TemplateRef<unknown>> {
    return this._templateRef.value;
  }

  set templateRef(templateRef: Maybe<TemplateRef<unknown>>) {
    this._templateRef.next(templateRef);
  }

  readonly url$ = this.anchor$.pipe(
    map((x) => x?.url),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly target$ = this.anchor$.pipe(
    map((x) => x?.target),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly selectedClass$ = this.selected$.pipe(
    map((selected) => (selected ? 'dbx-anchor-selected' : '')),
    shareReplay(1)
  );

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._templateRef.complete();
  }

  get srefAnchorConfig(): DbxInjectionComponentConfig {
    return this.dbNgxRouterWebProviderConfig.anchorSegueRefComponent;
  }

  clickAnchor(event?: Maybe<MouseEvent>): void {
    this.anchor?.onClick?.(event);
  }

  @HostListener('mouseenter')
  onMouseEnter(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('enter', event);
  }

  @HostListener('mouseleave')
  onMouseLeave(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('leave', event);
  }
}

// === After ===
import { skipFirstMaybe } from '@dereekb/rxjs';
import { Component, TemplateRef, HostListener, inject, viewChild, input, ChangeDetectionStrategy, computed } from '@angular/core';
import { AbstractDbxAnchorDirective, DbxInjectionComponentConfig, DbxInjectionComponent } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { NgTemplateOutlet, NgClass } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { shareReplay } from 'rxjs';
import { DbxRouterWebProviderConfig } from '../../provider/router.provider.config';

/**
 * Component that renders an anchor element depending on the input.
 */
@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  template: `
  @switch (typeSignal()) {
    @case ('plain') {
      <ng-container *ngTemplateOutlet="content"></ng-container>
    }
    @case ('clickable') {
      <a class="dbx-anchor-a dbx-anchor-click" [ngClass]="selectedClassSignal()" (click)="clickAnchor()">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
    }
    @case ('sref') {
      <dbx-injection [config]="srefAnchorConfig">
        <!-- Injected in child. -->
      </dbx-injection>
    }
    @case ('href') {
      <a class="dbx-anchor-a dbx-anchor-href" [href]="urlSignal()" [attr.target]="targetSignal()">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
    }
    @case ('disabled') {
      <a class="dbx-anchor-a dbx-anchor-disabled">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
    }
  }
  <!-- Template content -->
  <ng-template #content>
    <ng-content></ng-content>
  </ng-template>
  `,
  standalone: true,
  imports: [NgTemplateOutlet, NgClass, DbxInjectionComponent],
  host: {
    class: 'd-inline dbx-anchor',
    'dbx-anchor-block': 'block()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxAnchorComponent extends AbstractDbxAnchorDirective {
  private readonly _dbNgxRouterWebProviderConfig = inject(DbxRouterWebProviderConfig);

  readonly block = input<Maybe<boolean>>();

  readonly templateRef = viewChild<string, Maybe<TemplateRef<unknown>>>('content', { read: TemplateRef });
  readonly templateRef$ = toObservable(this.templateRef).pipe(skipFirstMaybe(), shareReplay(1));

  readonly selectedClassSignal = computed(() => (this.selectedSignal() ? 'dbx-anchor-selected' : ''));

  get srefAnchorConfig(): DbxInjectionComponentConfig {
    return this._dbNgxRouterWebProviderConfig.anchorSegueRefComponent;
  }

  clickAnchor(event?: Maybe<MouseEvent>): void {
    this.anchor?.onClick?.(event);
  }

  @HostListener('mouseenter')
  onMouseEnter(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('enter', event);
  }

  @HostListener('mouseleave')
  onMouseLeave(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('leave', event);
  }
}

//// ========== DbxActionAutoTriggerDirective ==========
// === Before ===
import { inject, Directive, Input, OnInit, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { debounce, distinctUntilChanged, exhaustMap, filter, first, map, mergeMap, shareReplay, switchMap, throttle, EMPTY, interval, Subject, combineLatest, Observable, BehaviorSubject } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { isDefinedAndNotFalse, type Maybe } from '@dereekb/util';

const DEFAULT_DEBOUNCE_MS = 2 * 1000;

const DEFAULT_THROTTLE_MS = 10 * 1000;

const DEFAULT_ERROR_THROTTLE_MS = 3 * 1000;

const MAX_ERRORS_TO_THROTTLE_ON = 6;

/**
 * Directive that automatically triggers the action periodically when it is in a modified state.
 *
 * When using auto triggers be sure to make sure that the action is not triggering too often due to misconfiguration.
 */
@Directive({
  selector: 'dbxActionAutoTrigger, [dbxActionAutoTrigger]',
  standalone: true
})
export class DbxActionAutoTriggerDirective<T = unknown, O = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  private readonly _triggerEnabled = new BehaviorSubject<boolean>(true);
  private readonly _triggerLimit = new BehaviorSubject<number | undefined>(undefined);
  private readonly _trigger = new Subject<number>();

  /**
   * How much to throttle the auto-triggering.
   */
  @Input('dbxActionAutoTrigger')
  get triggerEnabled(): boolean {
    return this._triggerEnabled.value;
  }

  set triggerEnabled(triggerEnabled: Maybe<boolean> | '') {
    triggerEnabled = triggerEnabled !== false; // Default to true

    if (this.triggerEnabled !== triggerEnabled) {
      this._triggerEnabled.next(triggerEnabled);
    }
  }

  @Input()
  triggerDebounce = DEFAULT_DEBOUNCE_MS;

  @Input()
  triggerThrottle = DEFAULT_THROTTLE_MS;

  @Input()
  triggerErrorThrottle = DEFAULT_ERROR_THROTTLE_MS;

  maxErrorsForThrottle = MAX_ERRORS_TO_THROTTLE_ON;

  /**
   * Optional input to override both triggerDebounce and triggerThrottle.
   *
   * Used in forms that are simple.
   */
  @Input()
  set useFastTriggerPreset(fastTrigger: Maybe<boolean> | '') {
    if (isDefinedAndNotFalse(fastTrigger)) {
      this.triggerDebounce = 200;
      this.triggerThrottle = 500;
    }
  }

  /**
   * Optional input to override both triggerDebounce and triggerThrottle to be 0.
   *
   * Used in forms that generally return a single value.
   */
  @Input()
  set instantTrigger(instantTrigger: Maybe<boolean> | '') {
    if (isDefinedAndNotFalse(instantTrigger)) {
      this.triggerDebounce = 10;
      this.triggerThrottle = 0;
    }
  }

  @Input()
  get triggerLimit(): Maybe<number> {
    return this._triggerLimit.value;
  }

  set triggerLimit(triggerLimit: Maybe<number>) {
    triggerLimit = triggerLimit || 0;
    this._triggerLimit.next(triggerLimit);
  }

  private _triggerCount = 0;

  readonly _errorCount$ = this.source.errorCountSinceLastSuccess$;

  readonly _triggerCount$ = this.source.isModifiedAndCanTriggerUpdates$.pipe(
    filter(() => this.isEnabled),
    filter((x) => x),
    debounce(() => interval(this.triggerDebounce)),
    throttle(
      () =>
        this._errorCount$.pipe(
          first(),
          exhaustMap((count) => interval(this.triggerThrottle + Math.min(count, this.maxErrorsForThrottle) * this.triggerErrorThrottle))
        ),
      { leading: true, trailing: true }
    ),
    // Check again for the "trailing" piece.
    filter(() => this.isEnabled),
    mergeMap(() => this.source.isModifiedAndCanTrigger$.pipe(first())),
    filter((x) => x),
    map(() => (this._triggerCount += 1)),
    shareReplay(1)
  );

  /**
   * Observable for the trigger mechanism.
   */
  readonly triggerCount$ = this._triggerEnabled.pipe(
    switchMap((enabled) => {
      if (enabled) {
        return this._triggerCount$;
      } else {
        return EMPTY;
      }
    })
  );

  private readonly _isTriggerLimited$: Observable<[number, boolean]> = combineLatest([this.triggerCount$, this._triggerLimit]).pipe(
    map(([triggerCount, limit]) => [triggerCount, limit ? triggerCount > limit : false] as [number, boolean]),
    shareReplay(1)
  );

  readonly isTriggerLimited$ = this._isTriggerLimited$.pipe(map((x) => x[1]));
  readonly trigger$: Observable<void> = this._isTriggerLimited$.pipe(
    filter((x) => !x[1]),
    distinctUntilChanged((a, b) => a[0] === b[0]), // Only trigger when the count changes.
    map(() => undefined as void)
  );

  get isEnabled(): boolean {
    return this.triggerEnabled !== false;
  }

  ngOnInit(): void {
    this.sub = this.trigger$.subscribe(() => {
      this.source.trigger();
    });
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._triggerEnabled.complete();
      this._trigger.complete();
      this._triggerLimit.complete();
    });
  }

}

// === After ===
import { inject, Directive, Input, OnInit, OnDestroy, input, computed, signal, InputSignalWithTransform } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { debounce, distinctUntilChanged, exhaustMap, filter, first, map, mergeMap, shareReplay, switchMap, throttle, EMPTY, interval, Subject, combineLatest, Observable, BehaviorSubject, tap } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { isDefinedAndNotFalse, isNotFalse, type Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

const DEFAULT_DEBOUNCE_MS = 2 * 1000;

const DEFAULT_THROTTLE_MS = 10 * 1000;

const DEFAULT_ERROR_THROTTLE_MS = 3 * 1000;

const MAX_ERRORS_TO_THROTTLE_ON = 6;

const DBX_ACTION_AUTO_TRIGGER_FAST_TRIGGER_DEBOUNCE = 200;
const DBX_ACTION_AUTO_TRIGGER_INSTANT_TRIGGER_DEBOUNCE = 10;

/**
 * Directive that automatically triggers the action periodically when it is in a modified state.
 *
 * When using auto triggers be sure to make sure that the action is not triggering too often due to misconfiguration.
 */
@Directive({
  selector: 'dbxActionAutoTrigger,[dbxActionAutoTrigger]',
  standalone: true
})
export class DbxActionAutoTriggerDirective<T = unknown, O = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly triggerDebounce = input<Maybe<number>, number>(DEFAULT_DEBOUNCE_MS, { transform: (x) => x ?? DEFAULT_DEBOUNCE_MS });
  readonly triggerThrottle = input<Maybe<number>, number>(DEFAULT_THROTTLE_MS, { transform: (x) => x ?? DEFAULT_THROTTLE_MS });
  readonly triggerErrorThrottle = input<Maybe<number>, number>(DEFAULT_ERROR_THROTTLE_MS, { transform: (x) => x ?? DEFAULT_ERROR_THROTTLE_MS });
  readonly maxErrorsForThrottle = input<Maybe<number>, number>(MAX_ERRORS_TO_THROTTLE_ON, { transform: (x) => x ?? MAX_ERRORS_TO_THROTTLE_ON });
  readonly triggerLimit = input<Maybe<number>>();
  readonly triggerEnabled = input<boolean, string | boolean>(true, { alias: 'dbxActionAutoTrigger', transform: isNotFalse });
  readonly useFastTriggerPreset = input<boolean, string | boolean>(false, { transform: isDefinedAndNotFalse });
  readonly useInstantTriggerPreset = input<boolean, string | boolean>(false, { transform: isDefinedAndNotFalse });

  readonly triggerDebounceSignal = computed(() => {
    let debounce = this.triggerDebounce() as number;

    if (debounce === undefined) {
      const useFastTrigger = this.useFastTriggerPreset();
      const useInstantTrigger = this.useInstantTriggerPreset();

      if (useFastTrigger) {
        debounce = DBX_ACTION_AUTO_TRIGGER_FAST_TRIGGER_DEBOUNCE;
      } else if (useInstantTrigger) {
        debounce = DBX_ACTION_AUTO_TRIGGER_INSTANT_TRIGGER_DEBOUNCE;
      }
    }

    return debounce;
  });

  readonly triggerThrottleSignal = computed(() => {
    let throttle = this.triggerThrottle() as number;

    if (throttle === undefined) {
      const useFastTrigger = this.useFastTriggerPreset();
      const useInstantTrigger = this.useInstantTriggerPreset();

      if (useFastTrigger) {
        throttle = DBX_ACTION_AUTO_TRIGGER_FAST_TRIGGER_DEBOUNCE;
      } else if (useInstantTrigger) {
        throttle = DBX_ACTION_AUTO_TRIGGER_INSTANT_TRIGGER_DEBOUNCE;
      }
    }

    return throttle;
  });

  readonly triggerCountSignal = signal<number>(0);

  readonly _errorCount$ = this.source.errorCountSinceLastSuccess$;
  readonly _triggerCount$ = this.source.isModifiedAndCanTriggerUpdates$.pipe(
    // each time something is triggered the
    filter(() => this.triggerEnabled() ?? false),
    debounce(() => interval(this.triggerDebounceSignal())),
    throttle(
      () =>
        this._errorCount$.pipe(
          first(),
          exhaustMap((errorCount) => {
            const maxErrors = this.maxErrorsForThrottle() ?? MAX_ERRORS_TO_THROTTLE_ON;
            const throttleTime = this.triggerErrorThrottle() ?? DEFAULT_ERROR_THROTTLE_MS;
            const additionalInterval = Math.min(errorCount, maxErrors) * throttleTime;

            return interval(this.triggerThrottleSignal() + additionalInterval);
          })
        ),
      { leading: true, trailing: true }
    ),
    // Check again for the "trailing" piece.
    filter(() => this.triggerEnabled() ?? false),
    mergeMap(() => this.source.isModifiedAndCanTrigger$.pipe(first())),
    filter((x) => x),
    map(() => {
      const count = this.triggerCountSignal();
      this.triggerCountSignal.update((x) => x + 1);
      return count;
    }),
    shareReplay(1)
  );

  /**
   * Observable for the trigger mechanism.
   */
  readonly triggerCount$ = toObservable(this.triggerEnabled).pipe(
    switchMap((enabled) => {
      let countObs: Observable<number>;

      if (enabled !== false) {
        countObs = this._triggerCount$;
      } else {
        countObs = EMPTY;
      }

      return countObs;
    })
  );

  private readonly _isTriggerLimited$: Observable<readonly [number, boolean]> = combineLatest([this.triggerCount$, toObservable(this.triggerLimit)]).pipe(
    map(([triggerCount, limit]) => {
      const isAllowedToRun = limit != null ? triggerCount < limit : true;
      return [triggerCount, isAllowedToRun] as const;
    }),
    shareReplay(1)
  );

  readonly isTriggerAllowedToRun$ = this._isTriggerLimited$.pipe(map((x) => x[1]), shareReplay(1));
  readonly automaticTrigger$: Observable<void> = this._isTriggerLimited$.pipe(
    filter((x) => x[1]),
    distinctUntilChanged((a, b) => a[0] === b[0]), // Only trigger when the count changes.
    map(() => undefined as void)
  );

  ngOnInit(): void {
    this.sub = this.automaticTrigger$.subscribe(() => {
      this.source.trigger();
    });
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
    });
  }

}

/// ========== DbxTwoColumnComponent ==========
// === BEFORE ===
import { ChangeDetectorRef, OnDestroy, ChangeDetectionStrategy, OnInit, Component, Input, ElementRef, inject } from '@angular/core';
import { AbstractSubscriptionDirective, safeMarkForCheck } from '@dereekb/dbx-core';
import { ResizedEvent } from 'angular-resize-event-package';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';

export interface DbxTwoColumnViewState {
  showRight: boolean;
  showFullLeft: boolean;
  hideLeftColumn: boolean;
  reverseSizing: boolean;
  inSectionPage: boolean;
}

/**
 * Responsive component meant to split a left and right column.
 *
 * The left column is smaller than the right column, which contains the primary content.
 *
 * Requires a TwoColumnsContextStore to be provided.
 */
@Component({
  selector: 'dbx-two-column',
  template: `
  <dbx-content-container grow="full" padding="none" class="dbx-content dbx-content-auto-height left-column">
    <div *ngIf="!v.hideLeftColumn && v.reverseSizing" (resized)="onResized($event)"></div>
    <ng-content select="[left]"></ng-content>
  </dbx-content-container>
  <dbx-content-container grow="full" padding="none" class="dbx-content dbx-content-auto-height right-column" *ngIf="v.showRight">
    <div *ngIf="v.hideLeftColumn || !v.reverseSizing" (resized)="onResized($event)"></div>
    <ng-content select="[right]"></ng-content>
  </dbx-content-container>
  `,
  exportAs: 'columns',
  host: {
    class: 'dbx-two-column',
    '[class]': "{ 'right-shown': v.showRight, 'full-left': v.showFullLeft,'hide-left-column': v.hideLeftColumn, 'two-column-reverse-sizing': v.reverseSizing, 'dbx-section-page-two': v.inSectionPage }"
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTwoColumnComponent extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private readonly _elementRef = inject(ElementRef);
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);
  readonly cdRef = inject(ChangeDetectorRef);

  private _view: DbxTwoColumnViewState = { showRight: false, showFullLeft: true, hideLeftColumn: false, reverseSizing: false, inSectionPage: false };

  private readonly _inSectionPage = new BehaviorSubject<boolean>(false);

  readonly reverseSizing$ = this.twoColumnsContextStore.reverseSizing$;
  readonly hideLeftColumn$: Observable<boolean> = this.twoColumnsContextStore.hideLeft$;
  readonly showRight$: Observable<boolean> = this.twoColumnsContextStore.showRight$;
  readonly showFullLeft$: Observable<boolean> = this.twoColumnsContextStore.showFullLeft$;

  readonly hideRight$: Observable<boolean> = this.twoColumnsContextStore.hideRight$;

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.sub = combineLatest([this.showRight$, this.showFullLeft$, this.hideLeftColumn$, this.reverseSizing$, this._inSectionPage]).subscribe(([showRight, showFullLeft, hideLeftColumn, reverseSizing, inSectionPage]: [boolean, boolean, boolean, boolean, boolean]) => {
      this._view = {
        showRight,
        showFullLeft,
        hideLeftColumn,
        reverseSizing,
        inSectionPage
      };

      safeMarkForCheck(this.cdRef);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._inSectionPage.complete();
  }

  get v(): DbxTwoColumnViewState {
    return this._view;
  }

  @Input()
  set reverseSizing(reverseSizing: boolean) {
    this.twoColumnsContextStore.setReverseSizing(reverseSizing);
  }

  @Input()
  set inSectionPage(inSectionPage: boolean) {
    this._inSectionPage.next(inSectionPage);
  }

  onResized(event: ResizedEvent): void {
    const totalWidth = (this._elementRef.nativeElement as HTMLElement).clientWidth;
    this.twoColumnsContextStore.setTotalWidth(totalWidth);
  }
}

// === AFTER ===
import { ChangeDetectorRef, OnDestroy, ChangeDetectionStrategy, OnInit, Component, Input, ElementRef, inject, signal, input, computed } from '@angular/core';
import { AbstractSubscriptionDirective, safeMarkForCheck } from '@dereekb/dbx-core';
import { AngularResizeEventModule, ResizedEvent } from 'angular-resize-event-package';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';
import { toObservable } from '@angular/core/rxjs-interop';

export interface DbxTwoColumnViewState {
  readonly showRight: boolean;
  readonly showFullLeft: boolean;
  readonly hideLeftColumn: boolean;
  readonly reverseSizing: boolean;
  readonly inSectionPage: boolean;
}

/**
 * Responsive component meant to split a left and right column.
 *
 * The left column is smaller than the right column, which contains the primary content.
 *
 * Requires a TwoColumnsContextStore to be provided.
 */
@Component({
  selector: 'dbx-two-column',
  template: `
  <dbx-content-container grow="full" padding="none" class="dbx-content dbx-content-auto-height left-column">
    @if (viewSignal().hideLeftColumn || !viewSignal().reverseSizing) {
      <div (resized)="viewResized($event)"></div>
    }
    <ng-content select="[left]"></ng-content>
  </dbx-content-container>
  @if (viewSignal().showRight) {
    <dbx-content-container grow="full" padding="none" class="dbx-content dbx-content-auto-height right-column">
      @if (viewSignal().hideLeftColumn || !viewSignal().reverseSizing) {
        <div (resized)="viewResized($event)"></div>
      }
      <ng-content select="[right]"></ng-content>
    </dbx-content-container>
  }
  `,
  exportAs: 'columns',
  host: {
    class: 'dbx-two-column',
    '[class]': "cssClassSignal()"
  },
  imports: [AngularResizeEventModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTwoColumnComponent extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private readonly _elementRef = inject(ElementRef);
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  readonly reverseSizing = input<boolean>(false);
  readonly inSectionPage = input<boolean>(false);

  readonly viewSignal = signal<DbxTwoColumnViewState>({ showRight: false, showFullLeft: true, hideLeftColumn: false, reverseSizing: false, inSectionPage: false });

  readonly cssClassSignal = computed(() => {
    const { showRight, showFullLeft, hideLeftColumn, reverseSizing, inSectionPage } = this.viewSignal();
    return { 'right-shown': showRight, 'full-left': showFullLeft, 'hide-left-column': hideLeftColumn, 'two-column-reverse-sizing': reverseSizing, 'dbx-section-page-two': inSectionPage };
  });

  readonly reverseSizing$ = this.twoColumnsContextStore.reverseSizing$;
  readonly hideLeftColumn$: Observable<boolean> = this.twoColumnsContextStore.hideLeft$;

  readonly showRight$: Observable<boolean> = this.twoColumnsContextStore.showRight$;
  readonly showFullLeft$: Observable<boolean> = this.twoColumnsContextStore.showFullLeft$;

  ngOnInit(): void {
    this.twoColumnsContextStore.setReverseSizing(toObservable(this.reverseSizing));
    this.sub = combineLatest([this.showRight$, this.showFullLeft$, this.hideLeftColumn$, this.reverseSizing$, toObservable(this.inSectionPage)])
      .subscribe(([showRight, showFullLeft, hideLeftColumn, reverseSizing, inSectionPage]: [boolean, boolean, boolean, boolean, boolean]) => {
        this.viewSignal.set({
          showRight,
          showFullLeft,
          hideLeftColumn,
          reverseSizing,
          inSectionPage
        });
      });
  }

  onResized(event: ResizedEvent): void {
    const totalWidth = (this._elementRef.nativeElement as HTMLElement).clientWidth;
    this.twoColumnsContextStore.setTotalWidth(totalWidth);
  }

}

/// ========== DbxTwoColumnRightComponent =========
// === BEFORE ===
import { AfterViewInit, OnDestroy, Component, Input, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';
import { type Maybe } from '@dereekb/util';

/**
 * Optional responsive component that wraps content on the right side and shows a navigation bar.
 *
 * When rendered it will trigger the context to show left.
 */
@Component({
  selector: 'dbx-two-column-right',
  template: `
  <dbx-two-column-head [block]="block" [full]="full">
    <!-- Back Buttons -->
    <ng-container *ngIf="showBack$ | async">
      <button mat-icon-button class="back-button" (click)="backClicked()" aria-label="back button">
        <mat-icon>navigate_before</mat-icon>
      </button>
    </ng-container>
    <ng-container *ngIf="ref$ | async">
      <dbx-anchor [anchor]="ref$ | async">
        <button mat-icon-button class="back-button" aria-label="back button">
          <mat-icon>navigate_before</mat-icon>
        </button>
      </dbx-anchor>
    </ng-container>
    <span *ngIf="header" class="right-nav-title">{{ header }}</span>
    <span class="right-nav-spacer"></span>
    <span class="spacer"></span>
    <ng-content select="[nav]"></ng-content>
  </dbx-two-column-head>
  <div class="dbx-two-column-right-content">
    <ng-content></ng-content>
  </div>
  `,
  host: {
    class: 'dbx-two-column-right d-block'
  }
})
export class DbxTwoColumnRightComponent implements AfterViewInit, OnDestroy {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  @Input()
  full: boolean = false;

  @Input()
  header?: Maybe<string>;

  @Input()
  block?: boolean;

  private _showBack = new BehaviorSubject<boolean>(true);

  readonly ref$: Observable<Maybe<ClickableAnchor>> = this.twoColumnsContextStore.backRef$;

  readonly showBack$: Observable<boolean> = combineLatest([
    this._showBack,
    this.ref$.pipe(map((x) => !x)) // TODO: Is this correct? Show back if ref is not defined?
  ]).pipe(map(([a, b]: [boolean, boolean]) => a && b));

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.twoColumnsContextStore.setHasRight(true);
    });
  }

  ngOnDestroy(): void {
    this._showBack.complete();
    this.twoColumnsContextStore.setHasRight(false);
  }

  @Input()
  get showBack(): boolean {
    return this._showBack.value;
  }

  set showBack(showBack: boolean) {
    this._showBack.next(showBack);
  }

  /**
   * Minimum right-side width allowed in pixels.
   */
  @Input()
  set minRightWidth(minRightWidth: Maybe<number | ''>) {
    this.twoColumnsContextStore.setMinRightWidth(typeof minRightWidth === 'number' ? minRightWidth : undefined);
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }
}

// === AFTER ===
import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, map } from 'rxjs';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';
import { type Maybe } from '@dereekb/util';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DbxTwoColumnColumnHeadDirective } from './two.column.head.directive';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxAnchorComponent } from '../../../router';

/**
 * Optional responsive component that wraps content on the right side and shows a navigation bar.
 *
 * When rendered it will trigger the context to show left.
 */
@Component({
  selector: 'dbx-two-column-right',
  template: `
  <dbx-two-column-head [block]="block()" [full]="full()">
    <!-- Back Buttons -->
    @if (showBackSignal()) {
      <button mat-icon-button class="back-button" (click)="backClicked()" aria-label="back button">
        <mat-icon>navigate_before</mat-icon>
      </button>
    }
    @if (refSignal()) {
      <dbx-anchor [anchor]="refSignal()">
        <button mat-icon-button class="back-button" aria-label="back button">
          <mat-icon>navigate_before</mat-icon>
        </button>
      </dbx-anchor>
    }
    @if (header()) {
      <span class="right-nav-title">{{ header() }}</span>
    }
    <span class="right-nav-spacer"></span>
    <span class="spacer"></span>
    <ng-content select="[nav]"></ng-content>
  </dbx-two-column-head>
  <div class="dbx-two-column-right-content">
    <ng-content></ng-content>
  </div>
  `,
  host: {
    class: 'dbx-two-column-right d-block'
  },
  imports: [DbxTwoColumnColumnHeadDirective, MatButtonModule, MatIconModule, DbxAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTwoColumnRightComponent implements OnInit, AfterViewInit {

  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  readonly full = input<boolean>(false);
  readonly header = input<Maybe<string>>();
  readonly block = input<Maybe<boolean>>();

  readonly showBack = input<boolean>(true);

  readonly alternativeBackRef$: Observable<Maybe<ClickableAnchor>> = this.twoColumnsContextStore.backRef$;
  readonly alternativeBackRefSignal = toSignal(this.alternativeBackRef$);

  /**
   * Minimum right-side width allowed in pixels.
   */
  readonly minRightWidth = input<Maybe<number>>();

  private readonly _minRightWidthSub = new SubscriptionObject();

  readonly showBackSignal = computed(() => {
    const showBack = this.showBack();
    const alternativeBackRef = this.alternativeBackRefSignal();

    // show the back signal if true and there is no alternative back
    return showBack && !alternativeBackRef;
  });

  ngOnInit(): void {
    this._minRightWidthSub.subscription = this.twoColumnsContextStore.setMinRightWidth(toObservable(this.minRightWidth));
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.twoColumnsContextStore.setHasRight(true);
    });
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }

}

/// ========== DbxButtonDirective =========
// === BEFORE ===
import { Directive, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, of, Subject, filter, first, switchMap } from 'rxjs';
import { AbstractSubscriptionDirective } from '../subscription';
import { DbxButton, DbxButtonDisplay, DbxButtonDisplayType, dbxButtonDisplayType, DbxButtonInterceptor, provideDbxButton } from './button';

/**
 * Abstract button component.
 */
@Directive()
export abstract class AbstractDbxButtonDirective extends AbstractSubscriptionDirective implements DbxButton, OnInit, OnDestroy {
  private readonly _disabled = new BehaviorSubject<boolean>(false);
  private readonly _working = new BehaviorSubject<boolean>(false);

  /**
   * Pre-interceptor button click.
   */
  protected readonly _buttonClick = new Subject<void>();
  protected readonly _buttonInterceptor = new BehaviorSubject<Maybe<DbxButtonInterceptor>>(undefined);

  readonly disabled$ = this._disabled.asObservable();
  readonly working$ = this._working.asObservable();

  @Input()
  get disabled(): boolean {
    return this._disabled.value;
  }

  set disabled(disabled: Maybe<boolean>) {
    this._disabled.next(disabled ?? false);
  }

  @Input()
  get working(): boolean {
    return this._working.value;
  }

  set working(working: Maybe<boolean>) {
    this._working.next(working ?? false);
  }

  @Input()
  icon?: Maybe<string>;

  @Input()
  text?: Maybe<string>;

  @Input()
  get buttonDisplay(): DbxButtonDisplay {
    return {
      icon: this.icon,
      text: this.text
    };
  }

  set buttonDisplay(buttonDisplay: Maybe<DbxButtonDisplay>) {
    this.icon = buttonDisplay?.icon;
    this.text = buttonDisplay?.text;
  }

  get buttonDisplayType(): DbxButtonDisplayType {
    return dbxButtonDisplayType(this.buttonDisplay);
  }

  @Output()
  readonly buttonClick = new EventEmitter();

  readonly clicked$ = this.buttonClick.asObservable();

  ngOnInit(): void {
    this.sub = this._buttonClick
      .pipe(
        switchMap(() =>
          this._buttonInterceptor.pipe(
            switchMap((x) => {
              if (x) {
                return x.interceptButtonClick().pipe(first());
              } else {
                return of(true);
              }
            }),
            filter((x) => Boolean(x)) // Ignore false values.
          )
        )
      )
      .subscribe(() => {
        this._forceButtonClicked();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._disabled.complete();
    this._working.complete();
    this._buttonClick.complete();
    this._buttonInterceptor.complete();
  }

  /**
   * Sets the button interceptor. If any interceptor is already set, it is replaced.
   */
  public setButtonInterceptor(interceptor: DbxButtonInterceptor): void {
    this._buttonInterceptor.next(interceptor);
  }

  /**
   * Main function to use for handling clicks on the button.
   */
  public clickButton(): void {
    if (!this.disabled) {
      this._buttonClick.next();
    }
  }

  /**
   * Forces a button click. Skips the interceptors if any are configured.
   */
  protected _forceButtonClicked(): void {
    this.buttonClick.emit();
  }
}

// MARK: Implementation
/**
 * Provides an DbxButton directive.
 */
@Directive({
  selector: '[dbxButton]',
  exportAs: 'dbxButton',
  providers: provideDbxButton(DbxButtonDirective),
  standalone: true
})
export class DbxButtonDirective extends AbstractDbxButtonDirective {}

// === AFTER ===
import { Directive, OnDestroy, OnInit, Signal, computed, input, output, signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { of, Subject, filter, first, switchMap, BehaviorSubject } from 'rxjs';
import { AbstractSubscriptionDirective } from '../subscription';
import { DbxButton, DbxButtonDisplay, DbxButtonDisplayType, dbxButtonDisplayType, DbxButtonInterceptor, provideDbxButton } from './button';
import { outputToObservable, toObservable } from '@angular/core/rxjs-interop';

/**
 * Abstract button component.
 */
@Directive()
export abstract class AbstractDbxButtonDirective extends AbstractSubscriptionDirective implements DbxButton, OnInit, OnDestroy {

  /**
   * Pre-interceptor button click.
   */
  protected readonly _buttonClick = new Subject<void>();
  protected readonly _buttonInterceptor = new BehaviorSubject<Maybe<DbxButtonInterceptor>>(undefined);

  readonly buttonClick = output();

  readonly disabled = input<boolean, Maybe<boolean>>(false, { transform: (value) => value ?? false });
  readonly working = input<boolean, Maybe<boolean>>(false, { transform: (value) => value ?? false });
  readonly buttonDisplayContent = input<Maybe<DbxButtonDisplay>>(undefined, { alias: 'buttonDisplay' });

  private readonly _disabledSignal = signal<Maybe<boolean>>(undefined);
  private readonly _workingSignal = signal<Maybe<boolean>>(undefined);
  private readonly _buttonDisplayContentSignal = signal<Maybe<DbxButtonDisplay>>(undefined);

  readonly disabledSignal = computed(() => this._disabledSignal() ?? this.disabled());
  readonly workingSignal = computed(() => this._workingSignal() ?? this.working());

  readonly icon = input<Maybe<string>>();
  readonly text = input<Maybe<string>>();

  readonly buttonDisplayContentSignal: Signal<DbxButtonDisplay> = computed(() => {
    const icon = this.icon();
    const text = this.text();
    const buttonDisplayContent = this._buttonDisplayContentSignal() ?? this.buttonDisplayContent();
    return { icon: icon ?? buttonDisplayContent?.icon, text: text ?? buttonDisplayContent?.text };
  });

  readonly buttonDisplayTypeSignal: Signal<DbxButtonDisplayType> = computed(() => {
    return dbxButtonDisplayType(this.buttonDisplayContentSignal());
  });

  readonly disabled$ = toObservable(this.disabledSignal);
  readonly working$ = toObservable(this.workingSignal);
  readonly displayContent$ = toObservable(this.buttonDisplayContentSignal);
  readonly clicked$ = outputToObservable(this.buttonClick);

  ngOnInit(): void {
    this.sub = this._buttonClick
      .pipe(switchMap(() =>
        this._buttonInterceptor.pipe(
          switchMap((x) => {
            if (x) {
              return x.interceptButtonClick().pipe(first());
            } else {
              return of(true);
            }
          }),
          filter((x) => Boolean(x)) // Ignore false values.
        )
      ))
      .subscribe(() => {
        this._forceButtonClicked();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._buttonClick.complete();
    this._buttonInterceptor.complete();
  }

  setDisabled(disabled?: Maybe<boolean>): void {
    this._disabledSignal.set(disabled);
  }

  setWorking(working?: Maybe<boolean>): void {
    this._workingSignal.set(working);
  }

  setDisplayContent(content: DbxButtonDisplay): void {
    this._buttonDisplayContentSignal.set(content);
  }

  /**
   * Sets the button interceptor. If any interceptor is already set, it is replaced.
   */
  public setButtonInterceptor(interceptor: DbxButtonInterceptor): void {
    this._buttonInterceptor.next(interceptor);
  }

  /**
   * Main function to use for handling clicks on the button.
   */
  public clickButton(): void {
    if (!this.disabled) {
      this._buttonClick.next();
    }
  }

  /**
   * Forces a button click. Skips the interceptors if any are configured.
   */
  protected _forceButtonClicked(): void {
    this.buttonClick.emit();
  }

}

// MARK: Implementation
/**
 * Provides an DbxButton directive.
 */
@Directive({
  selector: '[dbxButton]',
  exportAs: 'dbxButton',
  providers: provideDbxButton(DbxButtonDirective),
  standalone: true
})
export class DbxButtonDirective extends AbstractDbxButtonDirective { }
