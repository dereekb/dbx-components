import { switchMap, shareReplay, map, of } from 'rxjs';
import { Component, input, ChangeDetectionStrategy, inject } from '@angular/core';
import { DbxSidenavComponent } from './sidenav.component';
import { type Maybe } from '@dereekb/util';
import { type DbxBarColor } from '../../../layout/bar/bar';
import { SideNavDisplayMode } from './sidenav';
import { DbxSidenavPagebarComponent } from './sidenav.pagebar.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Page layout component designed for use inside a {@link DbxSidenavComponent}. Includes a sidenav-aware pagebar and a content area.
 *
 * When `mobileOnly` is true, the pagebar is hidden on non-mobile screen sizes.
 *
 * @dbxWebComponent
 * @dbxWebSlug sidenav-page
 * @dbxWebCategory navigation
 * @dbxWebRelated sidenav, navbar
 * @dbxWebSkillRefs dbx__ref__dbx-app-structure
 * @dbxWebMinimalExample ```html
 * <dbx-sidenav-page>Content</dbx-sidenav-page>
 * ```
 *
 * @example
 * ```html
 * <dbx-sidenav-page>
 *   <ui-view></ui-view>
 * </dbx-sidenav-page>
 * ```
 */
@Component({
  selector: 'dbx-sidenav-page',
  template: `
    <dbx-sidenav-pagebar [sidenavMenuIcon]="sidenavMenuIcon()" [color]="color()">
      <ng-content left select="[navLeft]"></ng-content>
      <ng-content select="[navRight]"></ng-content>
    </dbx-sidenav-pagebar>
    <div class="dbx-content-page dbx-sidenav-page-content">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'd-block',
    '[class.dbx-pagebar-hide]': 'hidePagebarSignal()'
  },
  imports: [DbxSidenavPagebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxSidenavPageComponent {
  readonly parent = inject(DbxSidenavComponent);

  readonly color = input<Maybe<DbxBarColor>>();
  readonly sidenavMenuIcon = input<Maybe<string>>();
  readonly mobileOnly = input<boolean>(false);

  readonly mobileOnly$ = toObservable(this.mobileOnly);

  readonly hidePagebar$ = this.mobileOnly$.pipe(
    switchMap((mobileOnly) => (mobileOnly ? this.parent.mode$.pipe(map((x) => x !== SideNavDisplayMode.MOBILE)) : of(false))),
    shareReplay(1)
  );

  readonly hidePagebarSignal = toSignal(this.hidePagebar$, { initialValue: false });
}
