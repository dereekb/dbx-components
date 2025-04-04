import { ChangeDetectorRef, OnDestroy, ChangeDetectionStrategy, OnInit, Component, Input, ElementRef, inject, signal, input, computed } from '@angular/core';
import { AbstractSubscriptionDirective, safeMarkForCheck } from '@dereekb/dbx-core';
import { AngularResizeEventModule, ResizedEvent } from 'angular-resize-event-package';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxContentContainerDirective } from '../../content';

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
    '[class]': 'cssClassesSignal()'
  },
  imports: [AngularResizeEventModule, DbxContentContainerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTwoColumnComponent extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private readonly _elementRef = inject(ElementRef);
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  readonly reverseSizing = input<boolean>(false);
  readonly inSectionPage = input<boolean>(false);

  readonly viewSignal = signal<DbxTwoColumnViewState>({ showRight: false, showFullLeft: true, hideLeftColumn: false, reverseSizing: false, inSectionPage: false });

  readonly cssClassesSignal = computed(() => {
    const { showRight, showFullLeft, hideLeftColumn, reverseSizing, inSectionPage } = this.viewSignal();
    return { 'right-shown': showRight, 'full-left': showFullLeft, 'hide-left-column': hideLeftColumn, 'two-column-reverse-sizing': reverseSizing, 'dbx-section-page-two': inSectionPage };
  });

  readonly reverseSizing$ = this.twoColumnsContextStore.reverseSizing$;
  readonly hideLeftColumn$: Observable<boolean> = this.twoColumnsContextStore.hideLeft$;

  readonly showRight$: Observable<boolean> = this.twoColumnsContextStore.showRight$;
  readonly showFullLeft$: Observable<boolean> = this.twoColumnsContextStore.showFullLeft$;

  ngOnInit(): void {
    this.twoColumnsContextStore.setReverseSizing(toObservable(this.reverseSizing));
    this.sub = combineLatest([this.showRight$, this.showFullLeft$, this.hideLeftColumn$, this.reverseSizing$, toObservable(this.inSectionPage)]).subscribe(([showRight, showFullLeft, hideLeftColumn, reverseSizing, inSectionPage]: [boolean, boolean, boolean, boolean, boolean]) => {
      this.viewSignal.set({
        showRight,
        showFullLeft,
        hideLeftColumn,
        reverseSizing,
        inSectionPage
      });
    });
  }

  viewResized(event: ResizedEvent): void {
    const totalWidth = (this._elementRef.nativeElement as HTMLElement).clientWidth;
    this.twoColumnsContextStore.setTotalWidth(totalWidth);
  }
}
