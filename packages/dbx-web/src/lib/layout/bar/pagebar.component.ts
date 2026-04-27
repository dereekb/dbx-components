import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxBarColor } from './bar';
import { NgClass } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';

/**
 * A page-level toolbar with left and right content slots, built on Angular Material's mat-toolbar.
 *
 * @dbxWebComponent
 * @dbxWebSlug pagebar
 * @dbxWebCategory layout
 * @dbxWebRelated bar, navbar
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks, dbx__ref__dbx-app-structure
 * @dbxWebMinimalExample ```html
 * <dbx-pagebar>Title</dbx-pagebar>
 * ```
 *
 * @example
 * ```html
 * <dbx-pagebar>
 *   <h2>Settings</h2>
 *   <span class="spacer"></span>
 *   <button mat-stroked-button>Save</button>
 * </dbx-pagebar>
 * ```
 */
@Component({
  selector: 'dbx-pagebar',
  template: `
    <mat-toolbar class="dbx-pagebar dbx-flex-bar" [ngClass]="cssClassSignal()">
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
