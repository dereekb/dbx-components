import { type ScreenMediaWidthType } from '../../screen/screen';
import { DbxScreenMediaService } from '../../screen/screen.service';
import { Directive, inject, input } from '@angular/core';
import { map, distinctUntilChanged, shareReplay } from 'rxjs';

import { type Maybe } from '@dereekb/util';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

/**
 * Creates a flex group container that arranges child elements in a responsive row layout.
 *
 * On small screens (below the configured breakpoint), the group applies a small-screen CSS class
 * that can be used to adjust styling. When `breakToColumn` is enabled, items will stack vertically
 * on small screens.
 *
 * @dbxWebComponent
 * @dbxWebSlug flex-group
 * @dbxWebCategory layout
 * @dbxWebRelated flex-size, bar
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxFlexGroup><div dbxFlexSize="1">A</div></div>
 * ```
 *
 * @example
 * ```html
 * <div dbxFlexGroup breakpoint="sm">
 *   <div dbxFlexSize="2">Wide</div>
 *   <div dbxFlexSize="1">Narrow</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFlexGroup]',
  host: {
    '[class.dbx-flex-group]': 'content()',
    '[class.dbx-flex-group-break-to-column]': 'breakToColumn()',
    '[class.dbx-flex-group-relative]': 'relative()',
    '[class.dbx-flex-group-small]': 'smallSignal()'
  },
  standalone: true
})
export class DbxFlexGroupDirective {
  private readonly _dbxScreenMediaService = inject(DbxScreenMediaService);

  /**
   * Whether to apply the flex group content styling. Defaults to `true`.
   */
  readonly content = input<boolean>(true);

  /**
   * Whether child items should break to a column layout on small screens.
   */
  readonly breakToColumn = input<boolean>(false);

  /**
   * Whether the flex group should use relative positioning.
   */
  readonly relative = input<boolean>(false);

  /**
   * Screen width breakpoint below which the group is considered "small". Defaults to `'tablet'`.
   */
  readonly breakpoint = input<ScreenMediaWidthType, Maybe<ScreenMediaWidthType>>('tablet', { transform: (x) => x ?? 'tablet' });

  readonly isSmallScreen$ = this._dbxScreenMediaService.isBreakpointActive(toObservable(this.breakpoint)).pipe(
    map((x) => !x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly smallSignal = toSignal(this.isSmallScreen$, { initialValue: false });
}
