import { ClickableAnchorLink, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { Component, ViewEncapsulation } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
import { mapKeysIntersectionToArray } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['../demo.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DemoLayoutComponent {

  readonly everyoneAnchors: ClickableAnchorLink[] = [{
    title: 'Home',
    ref: 'demo.home',
    icon: 'home'
  }];

  readonly adminAnchors: ClickableAnchorLink[] = [{
    title: 'Home',
    ref: 'demo.home',
    icon: 'home'
  }];

  readonly userAnchors: ClickableAnchorLink[] = [{
    title: 'Home',
    ref: 'demo.home',
    icon: 'home'
  }];

  readonly navAnchors$: Observable<ClickableAnchorLink[]> = of({
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
    title: 'Sign In',
    ref: 'demo.signup',
    icon: 'signup'
  }];

  readonly userBottomNavAnchors: ClickableAnchorLinkTree[] = [{
    title: 'Notifications',
    ref: 'demo.notification'
  }, {
    title: 'Settings',
    ref: 'demo.setting'
  }, {
    title: 'Logout',
    onClick: () => this.dbxAuthService.signOut()    // todo: change to signout confirmation popup
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
