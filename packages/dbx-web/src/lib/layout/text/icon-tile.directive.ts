import { Directive, input } from '@angular/core';

/**
 * Host-class form of the icon tile — applies the `dbx-icon-tile` utility
 * (flex-centered, 12px rounded, 8px padded) to an existing element. Use
 * this when an existing slot (e.g. a list row's `.item-icon` div) needs
 * the tile presentation without introducing a wrapping component, or
 * when stacking with another component that already owns the host (so a
 * `<dbx-icon-tile>` child element isn't possible).
 *
 * Pair with `[dbxColor]` (optionally `[dbxColorTone]`) on the same host
 * for a tonal/full-color background. The host has no background of its
 * own — only layout. For the convenient component form that renders the
 * `<mat-icon>` for you, use {@link DbxIconTileComponent} (`<dbx-icon-tile>`).
 *
 * Sizing, padding, border radius, font, and inner `.mat-icon` size are
 * all configurable via CSS custom properties on the host:
 * `--dbx-icon-tile-width`, `--dbx-icon-tile-height`,
 * `--dbx-icon-tile-min-width`, `--dbx-icon-tile-padding`,
 * `--dbx-icon-tile-border-radius`, `--dbx-icon-tile-font-size`,
 * `--dbx-icon-tile-font-weight`, `--dbx-icon-tile-icon-size`.
 *
 * @dbxWebComponent
 * @dbxWebSlug icon-tile-host
 * @dbxWebCategory layout
 * @dbxWebRelated icon-tile, dbx-color, list-two-line-item
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxIconTile [dbxColor]="'primary'" [dbxColorTone]="18">
 *   <mat-icon>star</mat-icon>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <div class="dbx-list-two-line-item dbx-list-two-line-item-with-icon">
 *   <div class="item-icon" dbxIconTile [dbxColor]="'primary'" [dbxColorTone]="18">
 *     <mat-icon>check_circle</mat-icon>
 *   </div>
 *   <div class="item-left">
 *     <span class="item-title">Title</span>
 *     <span class="item-details">Details</span>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxIconTile]',
  host: {
    class: 'dbx-icon-tile',
    '[class.dbx-icon-tile-round]': 'dbxIconTileRound()'
  },
  standalone: true
})
export class DbxIconTileDirective {
  /**
   * When `true`, applies the `dbx-icon-tile-round` modifier to render the
   * tile as a circle instead of a 12px-rounded square.
   */
  readonly dbxIconTileRound = input<boolean>(false);
}
