import { type ClickableAnchorLinkSegueRef, type ClickableAnchorLink, type ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { type Observable, map, of, shareReplay } from 'rxjs';
import { mapKeysIntersectionToArray } from '@dereekb/rxjs';
import { DbxFirebaseAuthService, DbxFirebaseDocumentStoreContextModelEntitiesSourceDirective, DbxFirebaseDocumentStoreContextStoreDirective, DbxFirebaseModelEntitiesPopoverButtonComponent, type DbxFirebaseModelEntitiesPopoverButtonConfig } from '@dereekb/dbx-firebase';
import { DbxSidenavComponent, DbxSetStyleDirective, DbxIfSidenavDisplayModeDirective, DbxContentBorderDirective, DbxSidenavPageComponent, DbxAnchorListComponent } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['../demo.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [DbxSidenavComponent, DbxSetStyleDirective, DbxIfSidenavDisplayModeDirective, DbxContentBorderDirective, DbxSidenavPageComponent, UIView, DbxAnchorListComponent, DbxFirebaseDocumentStoreContextStoreDirective, DbxFirebaseModelEntitiesPopoverButtonComponent, DbxFirebaseDocumentStoreContextModelEntitiesSourceDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
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
      title: 'Oidc Clients',
      ref: 'demo.app.oidc',
      icon: 'vpn_key'
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

  readonly navAnchorsSignal = toSignal(this.navAnchors$);

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
      onClick: () => void this.dbxAuthService.logOut() // todo: change to signout confirmation popup
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

  readonly bottomNavAnchorsSignal = toSignal(this.bottomNavAnchors$);

  readonly entitiesButtonConfig: DbxFirebaseModelEntitiesPopoverButtonConfig = {};
}
