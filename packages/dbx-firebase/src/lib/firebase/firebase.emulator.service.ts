import { Injectable } from '@angular/core';
import { ClickableAnchor, ClickableUrl } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseParsedEmulatorsConfig } from './emulators';

@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseEmulatorService {
  get useEmulators(): boolean {
    return this.emulatorsConfig.useEmulators || false;
  }

  get emulatorUIAnchor(): Maybe<ClickableUrl> {
    const ui = this.emulatorsConfig.ui;
    return ui
      ? {
          url: `http://${ui.host ?? 'localhost'}:${ui.port}`,
          target: '_blank'
        }
      : undefined;
  }

  constructor(readonly emulatorsConfig: DbxFirebaseParsedEmulatorsConfig) {}
}
