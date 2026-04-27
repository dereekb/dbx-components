import { ChangeDetectionStrategy, Component, ElementRef, inject, input, effect } from '@angular/core';

import { type Observable, combineLatest, distinctUntilChanged, map } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxContentContainerDirective } from '../../content/content.container.directive';
import { isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { DbxResizedDirective } from '../../../screen/resize.directive';
import { type ResizedEvent } from '../../../screen/resize';

/**
 * Represents the computed view state of a {@link DbxTwoColumnComponent}, capturing all layout flags
 * that determine column visibility and sizing behavior.
 */
export interface DbxTwoColumnViewState {
  readonly showRight: boolean;
  readonly showFullLeft: boolean;
  readonly hideLeftColumn: boolean;
  readonly reverseSizing: boolean;
  readonly inSectionPage: boolean;
}

/**
 * Responsive two-column layout that splits content into a narrower left column and a wider right column.
 *
 * The right column contains the primary content. When the viewport is too narrow to fit both columns,
 * the left column can be automatically hidden based on the configured minimum right width.
 *
 * Requires a {@link TwoColumnsContextStore} to be provided by a parent component or directive.
 *
 * @dbxWebComponent
 * @dbxWebSlug two-column
 * @dbxWebCategory layout
 * @dbxWebRelated two-column-right
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks, dbx__ref__dbx-app-structure
 * @dbxWebMinimalExample ```html
 * <dbx-two-column>
 *   <div left>Sidebar</div>
 *   <div right>Main</div>
 * </dbx-two-column>
 * ```
 *
 * @example
 * ```html
 * <dbx-two-column [inSectionPage]="true">
 *   <dbx-list left [state$]="state$" [config]="listConfig" />
 *   <dbx-two-column-right right header="Detail">
 *     <p>Selected item detail.</p>
 *   </dbx-two-column-right>
 * </dbx-two-column>
 * ```
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
export class DbxTwoColumnComponent {
  private readonly _elementRef = inject(ElementRef);

  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  /**
   * Whether to reverse the default column sizing so the left column is larger than the right.
   */
  readonly reverseSizing = input<boolean>(false);

  /**
   * Whether this two-column layout is rendered within a section page context.
   */
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

  protected readonly _reverseSizingEffect = effect(() => {
    this.twoColumnsContextStore.setReverseSizing(this.reverseSizing());
  });

  protected readonly _hasRightContentEffect = effect(() => {
    if (this.hasRightContent()) {
      this.twoColumnsContextStore.setHasRight(true);
    }
  });

  viewResized(_event: ResizedEvent): void {
    const totalWidth = (this._elementRef.nativeElement as HTMLElement).clientWidth;
    this.twoColumnsContextStore.setTotalWidth(totalWidth);
  }
}
