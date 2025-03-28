import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxFirebaseEmulatorsConfig } from './emulators';
import { provideDbxFirebaseEmulator } from './firebase.emulator.providers';

/**
 * Used to configure the DbxFirebaseEmulatorsConfig provider.
 *
 * @deprecated use provideDbxFirebaseEmulator instead.
 */
@NgModule()
export class DbxFirebaseEmulatorModule {
  static forRoot(config: DbxFirebaseEmulatorsConfig): ModuleWithProviders<DbxFirebaseEmulatorModule> {
    return {
      ngModule: DbxFirebaseEmulatorModule,
      providers: [provideDbxFirebaseEmulator(config)]
    };
  }
}
