import { DbxStyleService } from '@dereekb/dbx-web';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component } from '@angular/core';
import { environment } from '../../environments/environment';

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
  }

  readonly github: ClickableAnchor = {
    url: 'https://github.com/dereekb/dbx-components',
    target: '_blank'
  };

  constructor(readonly dbxStyleService: DbxStyleService) { }

  get showEmulatorButton() {
    return (environment.firebase.emulators.useEmulators === true);
  }

  get emulator(): ClickableAnchor {
    const ui = environment.firebase.emulators?.ui;

    return (ui) ? {
      url: `http://${ui.host ?? 'localhost'}:${ui.port}`,
      target: '_blank'
    } : {};
  }

}
