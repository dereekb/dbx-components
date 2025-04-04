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
