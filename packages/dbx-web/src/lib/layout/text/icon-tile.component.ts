import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type Maybe } from '@dereekb/util';

/**
 * Rounded, padded leading-icon tile. Renders a `<mat-icon>` from the
 * `icon` input centered inside a flex tile, or projects custom content
 * when `icon` is not supplied. Apply `[dbxColor]` (optionally with
 * `[dbxColorTone]`) directly on the host to give the tile a tonal or
 * full-color background — the tile itself sets layout only.
 *
 * Set `[round]="true"` to apply the `dbx-icon-tile-round` modifier and
 * render a circle instead of the default 12px-rounded square.
 *
 * Equivalent to writing `<div dbxIconTile [dbxColor]="'…'"><mat-icon>…</mat-icon></div>`,
 * but with the icon name as a single input. Backed by the same
 * `dbx-icon-tile` host class as {@link DbxIconTileDirective}, so the CSS
 * utility, the directive form, and this component all share styling.
 *
 * Sizing, padding, border radius, font, and inner `.mat-icon` size are
 * all configurable via CSS custom properties on the host:
 * `--dbx-icon-tile-width`, `--dbx-icon-tile-height`,
 * `--dbx-icon-tile-min-width`, `--dbx-icon-tile-padding`,
 * `--dbx-icon-tile-border-radius`, `--dbx-icon-tile-font-size`,
 * `--dbx-icon-tile-font-weight`, `--dbx-icon-tile-icon-size`.
 *
 * @dbxWebComponent
 * @dbxWebSlug icon-tile
 * @dbxWebCategory layout
 * @dbxWebRelated icon-tile-host, dbx-color, list-two-line-item
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebContentProjection Optional fallback content rendered when `icon` is not supplied (e.g. a custom icon component).
 * @dbxWebMinimalExample ```html
 * <dbx-icon-tile [icon]="'verified'" [dbxColor]="'success'"></dbx-icon-tile>
 * ```
 *
 * @example
 * ```html
 * <dbx-icon-tile [icon]="'check'" [dbxColor]="'primary'" [dbxColorTone]="18"></dbx-icon-tile>
 *
 * <dbx-icon-tile [icon]="'star'" [round]="true" [dbxColor]="'accent'"></dbx-icon-tile>
 *
 * <dbx-icon-tile [dbxColor]="'accent'">
 *   <my-custom-glyph></my-custom-glyph>
 * </dbx-icon-tile>
 * ```
 */
@Component({
  selector: 'dbx-icon-tile',
  template: `
    @if (icon(); as iconValue) {
      <mat-icon>{{ iconValue }}</mat-icon>
    } @else {
      <ng-content></ng-content>
    }
  `,
  host: {
    class: 'dbx-icon-tile',
    '[class.dbx-icon-tile-round]': 'round()'
  },
  imports: [MatIconModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxIconTileComponent {
  readonly icon = input<Maybe<string>>();
  readonly round = input<boolean>(false);
}
