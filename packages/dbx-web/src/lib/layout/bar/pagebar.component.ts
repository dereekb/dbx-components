import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxBarColor } from './bar';
import { NgClass } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';

/**
 * A page-level toolbar with left and right content slots, built on Angular Material's mat-toolbar.
 *
 * @example
 * ```html
 * <dbx-pagebar color="primary">
 *   <span left>Page Title</span>
 *   <button right mat-icon-button><mat-icon>settings</mat-icon></button>
 * </dbx-pagebar>
 * ```
 */
@Component({
  selector: 'dbx-pagebar',
  template: `
    <mat-toolbar class="dbx-pagebar" [ngClass]="cssClassSignal()">
      <ng-content select="[left]"></ng-content>
      <span class="spacer"></span>
      <ng-content select="[right]"></ng-content>
    </mat-toolbar>
  `,
  imports: [NgClass, MatToolbarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPagebarComponent {
  readonly color = input<Maybe<DbxBarColor>>();

  readonly cssClassSignal = computed(() => {
    const color = this.color();
    return color ? `dbx-bar-${color}` : '';
  });
}
