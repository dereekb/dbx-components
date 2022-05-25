import { ClickableAnchorLinkSegueRef, ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { Component, ViewEncapsulation } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
import { mapKeysIntersectionToArray } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './layout.component.html',
  encapsulation: ViewEncapsulation.None
})
export class AppLayoutComponent {

  readonly everyoneAnchors = [{
    title: 'Public Home',
    ref: 'app.home',
    icon: 'home'
  }];

  readonly adminAnchors: ClickableAnchorLinkSegueRef[] = [];

  readonly userAnchors: ClickableAnchorLinkSegueRef[] = [{
    title: 'App Home',
    ref: 'app.app.home',
    icon: 'home'
  }, {
    title: 'Guest Book',
    ref: 'app.app.guestbook.list',
    icon: 'list'
  }, {
    title: 'Your Profile',
    ref: 'app.app.profile',
    icon: 'person'
  }];

  readonly navAnchors$: Observable<ClickableAnchorLinkSegueRef[]> = of({
    'admin': this.adminAnchors,
    'user': this.userAnchors
  }).pipe(
    mapKeysIntersectionToArray(this.dbxAuthService.authRoles$),
    map(x => ([...this.everyoneAnchors, ...x])),
    shareReplay(1)
  );

  constructor(
    readonly dbxAuthService: DbxFirebaseAuthService
  ) { }

  readonly noUserBottomAnchors: ClickableAnchorLink[] = [{
    title: 'Log In',
    ref: 'app.auth.login',
    icon: 'login'
  }];

  readonly userBottomNavAnchors: ClickableAnchorLinkTree[] = [{
    title: 'Notifications',
    ref: 'app.notification',
    disabled: true
  }, {
    title: 'Settings',
    ref: 'app.setting',
    disabled: true
  }, {
    title: 'Logout',
    onClick: () => this.dbxAuthService.logOut()    // todo: change to signout confirmation popup
  }];

  readonly anonymousBottomNavAnchors: ClickableAnchorLinkTree[] = [];

  readonly bottomNavAnchors$: Observable<ClickableAnchorLink[]> = this.dbxAuthService.authUserState$.pipe(
    map((state) => {
      const anchorsForState: { [key: string]: ClickableAnchorLink[] } = {
        'none': this.noUserBottomAnchors,
        'anon': this.anonymousBottomNavAnchors,
        'user': this.userBottomNavAnchors
      };

      return anchorsForState[state] ?? [];
    }),
    shareReplay(1)
  );

}
