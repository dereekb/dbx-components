import { Injectable, inject } from '@angular/core';
import { ClickableUrl } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseParsedEmulatorsConfig } from './emulators';

@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseEmulatorService {
  readonly emulatorsConfig = inject(DbxFirebaseParsedEmulatorsConfig);

  get useEmulators(): boolean {
    return this.emulatorsConfig.useEmulators || false;
  }

  get emulatorUIAnchor(): Maybe<ClickableUrl> {
    const ui = this.emulatorsConfig.ui;
    let host = this.emulatorsConfig.host;

    // Issue where sometimes 0.0.0.0 is not configured to handle transferring traffic properly, compared to localhost. This sets 0.0.0.0 to localhost unless disallowed.
    if (host === '0.0.0.0' && this.emulatorsConfig.allow0000ToLocalhost !== false) {
      host = 'localhost';
    }

    return ui
      ? {
          url: `http://${host ?? 'localhost'}:${ui.port}`,
          target: '_blank'
        }
      : undefined;
  }
}
