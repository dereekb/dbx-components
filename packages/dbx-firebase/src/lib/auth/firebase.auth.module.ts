import { Injector, ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { DbxAuthService } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService, DbxFirebaseAuthServiceDelegate } from './service/firebase.auth.service';

export interface DbxFirebaseAuthModuleConfig {
  delegateFactory?: (injector: Injector) => DbxFirebaseAuthServiceDelegate;
}

@NgModule({})
export class DbxFirebaseAuthModule {
  static forRoot(config: DbxFirebaseAuthModuleConfig): ModuleWithProviders<DbxFirebaseAuthModule> {
    const providers: Provider[] = [
      DbxFirebaseAuthService,
      {
        provide: DbxAuthService,
        useExisting: DbxFirebaseAuthService
      }
    ];

    if (config.delegateFactory) {
      providers.push({
        provide: DbxFirebaseAuthServiceDelegate,
        useFactory: config.delegateFactory,
        deps: [Injector]
      });
    }

    return {
      ngModule: DbxFirebaseAuthModule,
      providers
    };
  }
}
