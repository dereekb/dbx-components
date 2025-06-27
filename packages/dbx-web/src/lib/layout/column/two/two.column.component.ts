import { OnDestroy, ChangeDetectionStrategy, Component, ElementRef, inject, input, effect } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { Observable, combineLatest, distinctUntilChanged, map } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxContentContainerDirective } from '../../content/content.container.directive';
import { isDefinedAndNotFalse, Maybe } from '@dereekb/util';
import { DbxResizedDirective } from '../../../screen/resize.directive';
import { ResizedEvent } from '../../../screen/resize';

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
      @if (!hideLeftColumnSignal() && reverseSizingSignal()) {
        <div (dbxResized)="viewResized($event)"></div>
      }
      <ng-content select="[left]"></ng-content>
    </dbx-content-container>
    @if (showRightSignal()) {
      <dbx-content-container grow="full" padding="none" class="dbx-content dbx-content-auto-height right-column">
        @if (hideLeftColumnSignal() || !reverseSizingSignal()) {
          <div (dbxResized)="viewResized($event)"></div>
        }
        <ng-content select="[right]"></ng-content>
      </dbx-content-container>
    }
  `,
  exportAs: 'columns',
  host: {
    class: 'dbx-two-column',
    '[class]': 'cssClassSignal()'
  },
  imports: [DbxResizedDirective, DbxContentContainerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTwoColumnComponent extends AbstractSubscriptionDirective implements OnDestroy {
  private readonly _elementRef = inject(ElementRef);
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  readonly reverseSizing = input<boolean>(false);
  readonly inSectionPage = input<boolean>(false);

  /**
   * Acts as an override to show the right column without having to use dbx-two-column-right or update the context store directly.
   */
  readonly hasRightContent = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });

  readonly reverseSizing$ = this.twoColumnsContextStore.reverseSizing$;
  readonly hideLeftColumn$: Observable<boolean> = this.twoColumnsContextStore.hideLeft$;
  readonly inSectionPage$: Observable<boolean> = toObservable(this.inSectionPage);

  readonly showRight$: Observable<boolean> = this.twoColumnsContextStore.showRight$;
  readonly showFullLeft$: Observable<boolean> = this.twoColumnsContextStore.showFullLeft$;

  readonly hideLeftColumnSignal = toSignal(this.hideLeftColumn$);
  readonly reverseSizingSignal = toSignal(this.reverseSizing$);
  readonly showRightSignal = toSignal(this.showRight$);

  readonly cssClasses$ = combineLatest([this.showRight$, this.showFullLeft$, this.hideLeftColumn$, this.reverseSizing$, this.inSectionPage$]).pipe(
    distinctUntilChanged((prev, curr) => {
      return prev[0] === curr[0] && prev[1] === curr[1] && prev[2] === curr[2] && prev[3] === curr[3] && prev[4] === curr[4];
    }),
    map(([showRight, showFullLeft, hideLeftColumn, reverseSizing, inSectionPage]) => ({ 'right-shown': showRight, 'full-left': showFullLeft, 'hide-left-column': hideLeftColumn, 'two-column-reverse-sizing': reverseSizing, 'dbx-section-page-two': inSectionPage }))
  );

  readonly cssClassSignal = toSignal(this.cssClasses$);

  protected readonly _reverseSizingEffect = effect(
    () => {
      this.twoColumnsContextStore.setReverseSizing(this.reverseSizing());
    },
    { allowSignalWrites: true }
  );

  protected readonly _hasRightContentEffect = effect(
    () => {
      if (this.hasRightContent()) {
        this.twoColumnsContextStore.setHasRight(true);
      }
    },
    { allowSignalWrites: true }
  );

  viewResized(event: ResizedEvent): void {
    const totalWidth = (this._elementRef.nativeElement as HTMLElement).clientWidth;
    this.twoColumnsContextStore.setTotalWidth(totalWidth);
  }
}
