import { BehaviorSubject, switchMap, shareReplay, map, of } from 'rxjs';
import { Component, Input, OnDestroy } from '@angular/core';
import { DbxSidenavComponent } from './sidenav.component';
import { Maybe } from '@dereekb/util';
import { DbxBarColor } from '../../../layout/bar/bar';
import { SideNavDisplayMode } from './sidenav';

/**
 * Pre-configured page used with DbxSidenavComponent.
 *
 * Can optionally be configured to only show the pagebar while in mobile mode.
 */
@Component({
  selector: 'dbx-sidenav-page',
  template: `
    <div [ngClass]="(hidePagebar$ | async) ? 'dbx-pagebar-hide' : ''">
      <dbx-sidenav-pagebar [sidenavMenuIcon]="sidenavMenuIcon" [color]="color">
        <ng-content left select="[navLeft]"></ng-content>
        <ng-content select="[navRight]"></ng-content>
      </dbx-sidenav-pagebar>
      <div class="dbx-content-page dbx-sidenav-page-content">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class DbxSidenavPageComponent implements OnDestroy {
  @Input()
  sidenavMenuIcon: Maybe<string>;

  @Input()
  color?: Maybe<DbxBarColor>;

  private _mobileOnly = new BehaviorSubject<boolean>(false);

  readonly hidePagebar$ = this._mobileOnly.pipe(
    switchMap((mobileOnly) => (mobileOnly ? this.parent.mode$.pipe(map((x) => x !== SideNavDisplayMode.MOBILE)) : of(false))),
    shareReplay(1)
  );

  constructor(readonly parent: DbxSidenavComponent) {}

  ngOnDestroy(): void {
    this._mobileOnly.complete();
  }

  @Input()
  get mobileOnly(): boolean {
    return this._mobileOnly.value;
  }

  set mobileOnly(mobileOnly: boolean) {
    this._mobileOnly.next(mobileOnly);
  }
}
