import { DbxStyleService } from '@dereekb/dbx-web';
import { ClickableAnchor, DbxRouterService, DbxRouterTransitionService, isLatestSuccessfulRoute } from '@dereekb/dbx-core';
import { Component, inject } from '@angular/core';
import { DbxFirebaseEmulatorService } from '@dereekb/dbx-firebase';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: true
})
export class AppLayoutComponent {
  readonly dbxStyleService = inject(DbxStyleService);
  readonly dbxFirebaseEmulatorService = inject(DbxFirebaseEmulatorService);

  readonly isDemoRouteActive$ = isLatestSuccessfulRoute({
    dbxRouterService: inject(DbxRouterService),
    dbxRouterTransitionService: inject(DbxRouterTransitionService),
    routes: ['demo']
  }).pipe(distinctUntilChanged(), shareReplay(1));

  readonly showToggleDarkThemeButton$ = this.isDemoRouteActive$.pipe(map((x) => !x));

  readonly landing: ClickableAnchor = {
    ref: 'landing'
  };

  readonly doc: ClickableAnchor = {
    ref: 'doc'
  };

  readonly demo: ClickableAnchor = {
    ref: 'demo'
  };

  readonly toggleDarkTheme: ClickableAnchor = {
    onClick: () => this.dbxStyleService.toggleDarkSuffix()
  };

  readonly github: ClickableAnchor = {
    url: 'https://github.com/dereekb/dbx-components',
    target: '_blank'
  };

  readonly showEmulatorButton = this.dbxFirebaseEmulatorService.useEmulators === true;
  readonly emulator: ClickableAnchor = this.dbxFirebaseEmulatorService.emulatorUIAnchor ?? {};
}
