import { ClickableAnchorLinkSegueRef, ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
import { mapKeysIntersectionToArray } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['../demo.scss'],
  encapsulation: ViewEncapsulation.None
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
