import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { delay, type Observable } from 'rxjs';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';
import { type Maybe } from '@dereekb/util';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DbxTwoColumnColumnHeadDirective } from './two.column.head.directive';
import { DbxAnchorComponent } from '../../../router';

/**
 * Wraps right-column content within a {@link DbxTwoColumnComponent} and renders a navigation bar with a back button.
 *
 * When this component is created, it automatically registers itself with the {@link TwoColumnsContextStore}
 * to indicate that right-side content is present.
 *
 * @dbxWebComponent
 * @dbxWebSlug two-column-right
 * @dbxWebCategory layout
 * @dbxWebRelated two-column
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks, dbx__ref__dbx-app-structure
 * @dbxWebMinimalExample ```html
 * <dbx-two-column-right>Body</dbx-two-column-right>
 * ```
 *
 * @example
 * ```html
 * <dbx-two-column-right header="Item Detail">
 *   <button nav mat-icon-button><mat-icon>delete</mat-icon></button>
 *   <p>Body content</p>
 * </dbx-two-column-right>
 * ```
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
      @if (alternativeBackRefSignal()) {
        <dbx-anchor [anchor]="alternativeBackRefSignal()">
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
export class DbxTwoColumnRightComponent {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  /**
   * Whether the header area should expand to full width.
   */
  readonly full = input<boolean>(false);

  /**
   * Optional title text displayed in the navigation bar header.
   */
  readonly header = input<Maybe<string>>();

  /**
   * Whether the header should use block-level display.
   */
  readonly block = input<Maybe<boolean>>();

  /**
   * Whether to show the default back button. Defaults to `true`.
   * If a `backRef` is set on the store, that anchor is used instead.
   */
  readonly showBack = input<boolean>(true);

  readonly alternativeBackRef$: Observable<Maybe<ClickableAnchor>> = this.twoColumnsContextStore.backRef$;
  readonly alternativeBackRefSignal = toSignal(this.alternativeBackRef$.pipe(delay(0)));

  /**
   * Minimum right-side width allowed in pixels.
   */
  readonly minRightWidth = input<Maybe<number>>();

  protected readonly _setMinRightWidthEffect = effect(() => {
    this.twoColumnsContextStore.setMinRightWidth(this.minRightWidth());
  });

  readonly showBackSignal = computed(() => {
    const showBack = this.showBack();
    const alternativeBackRef = this.alternativeBackRefSignal();

    // show the back signal if true and there is no alternative back
    return showBack && !alternativeBackRef;
  });

  constructor() {
    this.twoColumnsContextStore.setHasRight(true);
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }
}
