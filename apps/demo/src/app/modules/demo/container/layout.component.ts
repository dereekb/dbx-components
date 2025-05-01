import { ClickableAnchorLinkSegueRef, ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
import { mapKeysIntersectionToArray } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxSidenavComponent } from '../../../../../../../packages/dbx-web/src/lib/router/layout/sidenav/sidenav.component';
import { DbxSetStyleDirective } from '../../../../../../../packages/dbx-web/src/lib/layout/style/style.set.directive';
import { DbxIfSidenavDisplayModeDirective } from '../../../../../../../packages/dbx-web/src/lib/router/layout/sidenav/sidenav.ifdisplaymode.directive';
import { DbxContentBorderDirective } from '../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { DbxSidenavPageComponent } from '../../../../../../../packages/dbx-web/src/lib/router/layout/sidenav/sidenav.page.component';
import { UIView } from '@uirouter/angular';
import { DbxAnchorListComponent } from '../../../../../../../packages/dbx-web/src/lib/router/layout/anchorlist/anchorlist.component';
import { AsyncPipe } from '@angular/common';

@Component({
    templateUrl: './layout.component.html',
    styleUrls: ['../demo.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [DbxSidenavComponent, DbxSetStyleDirective, DbxIfSidenavDisplayModeDirective, DbxContentBorderDirective, DbxSidenavPageComponent, UIView, DbxAnchorListComponent, AsyncPipe]
})
export class DemoLayoutComponent {
  readonly dbxAuthService = inject(DbxFirebaseAuthService);

  readonly everyoneAnchors = [
    {
      title: 'Public Home',
      ref: 'demo.home',
      icon: 'home'
    }
  ];

  readonly adminAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'Admin Home',
      ref: 'demo.home',
      icon: 'home'
    }
  ];

  readonly userAnchors: ClickableAnchorLinkSegueRef[] = [
    {
      title: 'App Home',
      ref: 'demo.app.home',
      icon: 'home'
    },
    {
      title: 'Guest Book',
      ref: 'demo.app.guestbook.list',
      icon: 'list'
    },
    {
      title: 'Your Profile',
      ref: 'demo.app.profile',
      icon: 'person'
    }
  ];

  readonly navAnchors$: Observable<ClickableAnchorLinkSegueRef[]> = of({
    admin: this.adminAnchors,
    user: this.userAnchors
  }).pipe(
    mapKeysIntersectionToArray(this.dbxAuthService.authRoles$),
    map((x) => [...this.everyoneAnchors, ...x]),
    shareReplay(1)
  );

  readonly noUserBottomAnchors: ClickableAnchorLink[] = [
    {
      title: 'Log In',
      ref: 'demo.auth.login',
      icon: 'login'
    }
  ];

  readonly userBottomNavAnchors: ClickableAnchorLinkTree[] = [
    {
      title: 'History',
      ref: 'demo.app.history',
      icon: 'history'
    },
    {
      title: 'Notifications',
      ref: 'demo.app.notification',
      icon: 'notifications'
    },
    {
      title: 'Settings',
      ref: 'demo.app.settings',
      icon: 'settings'
    },
    {
      title: 'Logout',
      onClick: () => this.dbxAuthService.logOut() // todo: change to signout confirmation popup
    }
  ];

  readonly anonymousBottomNavAnchors: ClickableAnchorLinkTree[] = [];

  readonly bottomNavAnchors$: Observable<ClickableAnchorLink[]> = this.dbxAuthService.authUserState$.pipe(
    map((state) => {
      const anchorsForState: { [key: string]: ClickableAnchorLink[] } = {
        none: this.noUserBottomAnchors,
        anon: this.anonymousBottomNavAnchors,
        user: this.userBottomNavAnchors
      };

      return anchorsForState[state] ?? [];
    }),
    shareReplay(1)
  );
}
