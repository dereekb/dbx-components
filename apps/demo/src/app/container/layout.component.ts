import { DbxStyleService } from '@dereekb/dbx-web';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component } from '@angular/core';
import { DbxFirebaseEmulatorService } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class AppLayoutComponent {
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

  constructor(readonly dbxStyleService: DbxStyleService, readonly dbxFirebaseEmulatorService: DbxFirebaseEmulatorService) {}

  get showEmulatorButton() {
    return this.dbxFirebaseEmulatorService.useEmulators === true;
  }

  get emulator(): ClickableAnchor {
    return this.dbxFirebaseEmulatorService.emulatorUIAnchor ?? {};
  }
}
