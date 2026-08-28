import { Injectable, inject } from '@angular/core';
import { type ClickableUrl } from '@dereekb/dbx-core';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type DbxFirebaseEmulatorConfig, DbxFirebaseParsedEmulatorsConfig } from './emulators';

@Injectable()
export class DbxFirebaseEmulatorService {
  readonly emulatorsConfig = inject(DbxFirebaseParsedEmulatorsConfig);

  get useEmulators(): boolean {
    return this.emulatorsConfig.useEmulators || false;
  }

  /**
   * Returns the origin (protocol and host, with no trailing slash) the BROWSER should use to reach the
   * input emulator, or undefined if that emulator is not configured.
   *
   * The `0.0.0.0` fix lives here rather than at each call site: the emulators bind to `0.0.0.0` so traffic
   * from outside the container reaches them, but a browser cannot always route to that address, so it is
   * rewritten to localhost unless disallowed. Any url handed to the browser needs that rewrite, which is
   * why this is shared rather than repeated.
   *
   * @param emulator - The parsed config of the emulator to reach.
   * @returns The emulator's origin, or undefined when it is not configured.
   */
  originForEmulator(emulator: Maybe<Required<DbxFirebaseEmulatorConfig>>): Maybe<WebsiteUrl> {
    let result: Maybe<WebsiteUrl>;

    if (emulator) {
      const host = emulator.host === '0.0.0.0' && this.emulatorsConfig.allow0000ToLocalhost !== false ? 'localhost' : emulator.host;
      result = `http://${host}:${emulator.port}`;
    }

    return result;
  }

  /**
   * Origin of the storage emulator, or undefined when the app is not pointed at one.
   *
   * Gated on the same condition `createDbxFirebaseStorage()` uses to decide whether to call
   * `connectStorageEmulator()`, so this answers "is storage emulated" rather than merely "is a storage
   * emulator configured".
   *
   * @returns The storage emulator's origin, or undefined when storage is not emulated.
   */
  get storageEmulatorOrigin(): Maybe<WebsiteUrl> {
    return this.useEmulators ? this.originForEmulator(this.emulatorsConfig.storage) : undefined;
  }

  get emulatorUIAnchor(): Maybe<ClickableUrl> {
    const url = this.originForEmulator(this.emulatorsConfig.ui);

    return url
      ? {
          url,
          target: '_blank'
        }
      : undefined;
  }
}
