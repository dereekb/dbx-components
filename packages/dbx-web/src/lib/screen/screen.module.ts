import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxScreenMediaService, DbxScreenMediaServiceConfig, DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG } from './screen.service';

@NgModule()
export class DbxScreenModule {

  static forRoot(config: DbxScreenMediaServiceConfig = DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG): ModuleWithProviders<DbxScreenModule> {
    return {
      ngModule: DbxScreenModule,
      providers: [
        {
          provide: DbxScreenMediaServiceConfig,
          useValue: config
        },
        DbxScreenMediaService
      ]
    };
  }

}
