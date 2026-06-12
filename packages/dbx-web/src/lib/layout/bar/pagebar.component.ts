import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';

/**
 * A page-level toolbar with left and right content slots, built on Angular Material's mat-toolbar.
 *
 * To give it a themed background apply `[dbxColor]` directly on the host — the inner `mat-toolbar` maps its
 * `--mat-toolbar-*` colors to the inherited tokens via the `dbx-pagebar.dbx-color mat-toolbar` SCSS.
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
 * <dbx-pagebar dbxColor="primary">
 *   <h2>Settings</h2>
 *   <span class="spacer"></span>
 *   <button mat-stroked-button>Save</button>
 * </dbx-pagebar>
 * ```
 */
@Component({
  selector: 'dbx-pagebar',
  template: `
    <mat-toolbar class="dbx-pagebar dbx-flex-bar">
      <ng-content select="[left]"></ng-content>
      <span class="spacer"></span>
      <ng-content select="[right]"></ng-content>
    </mat-toolbar>
  `,
  imports: [MatToolbarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPagebarComponent {}
