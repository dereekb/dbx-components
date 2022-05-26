import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxFirebaseEmulatorConfig, DbxFirebaseEmulatorsConfig, DbxFirebaseParsedEmulatorsConfig } from './emulators';
import { Maybe } from '@dereekb/util';

/**
 * Used to configure the DbxFirebaseEmulatorsConfig provider.
 */
@NgModule()
export class DbxFirebaseEmulatorModule {
  static forRoot(config: DbxFirebaseEmulatorsConfig): ModuleWithProviders<DbxFirebaseEmulatorModule> {
    const defaultHost = config.host ?? 'localhost';

    function emulatorConfig(emulator: Maybe<DbxFirebaseEmulatorConfig>): Required<DbxFirebaseEmulatorConfig> | undefined {
      return emulator ? { host: emulator.host ?? defaultHost, port: emulator.port } : undefined;
    }

    const finalConfig: DbxFirebaseParsedEmulatorsConfig = {
      useEmulators: config.useEmulators !== false,
      auth: emulatorConfig(config.auth),
      firestore: emulatorConfig(config.firestore),
      storage: emulatorConfig(config.storage),
      functions: emulatorConfig(config.functions),
      database: emulatorConfig(config.database)
    };

    return {
      ngModule: DbxFirebaseEmulatorModule,
      providers: [
        {
          provide: DbxFirebaseParsedEmulatorsConfig,
          useValue: finalConfig
        }
      ]
    };
  }
}
