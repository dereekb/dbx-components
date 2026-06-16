import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { MatIconModule } from '@angular/material/icon';
import { DbxBarDirective } from './bar.directive';

/**
 * A header bar displaying an optional icon and text label, useful as a section divider.
 *
 * To give it a themed background apply `[dbxColor]` directly on the host — the inner `<dbx-bar>` paints from the
 * inherited tokens via the `dbx-bar-header.dbx-color .dbx-bar` SCSS.
 *
 * @dbxWebComponent
 * @dbxWebSlug bar-header
 * @dbxWebCategory layout
 * @dbxWebRelated bar, pagebar
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-bar-header header="Title"></dbx-bar-header>
 * ```
 *
 * @example
 * ```html
 * <dbx-bar-header header="Members" icon="group" dbxColor="primary">
 *   <button mat-icon-button><mat-icon>add</mat-icon></button>
 * </dbx-bar-header>
 * ```
 */
@Component({
  selector: 'dbx-bar-header',
  template: `
    <dbx-bar>
      @if (icon()) {
        <mat-icon class="button-spacer">{{ icon() }}</mat-icon>
      }
      @if (text()) {
        <span>{{ text() }}</span>
      }
      <ng-content></ng-content>
    </dbx-bar>
  `,
  host: {
    class: 'dbx-bar-header dbx-hint'
  },
  imports: [DbxBarDirective, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxBarHeaderComponent {
  readonly text = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();
}
