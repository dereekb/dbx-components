import { switchMap, shareReplay, map, of } from 'rxjs';
import { Component, input, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { DbxSidenavComponent } from './sidenav.component';
import { type Maybe } from '@dereekb/util';
import { DbxBarColor } from '../../../layout/bar/bar';
import { SideNavDisplayMode } from './sidenav';
import { NgClass } from '@angular/common';
import { DbxSidenavPagebarComponent } from './sidenav.pagebar.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Pre-configured page used with DbxSidenavComponent.
 *
 * Can optionally be configured to only show the pagebar while in mobile mode.
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
  imports: [NgClass, DbxSidenavPagebarComponent],
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
