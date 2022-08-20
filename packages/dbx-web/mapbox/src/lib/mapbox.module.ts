import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxMapboxMapDirective } from './mapbox.store.map.directive';
import { DbxMapboxConfig } from './mapbox.service';

@NgModule({
  imports: [CommonModule],
  declarations: [DbxMapboxMapDirective],
  exports: [DbxMapboxMapDirective]
})
export class DbxMapboxModule {
  static forRoot(config: DbxMapboxConfig): ModuleWithProviders<DbxMapboxModule> {
    return {
      ngModule: DbxMapboxModule,
      providers: [
        {
          provide: DbxMapboxConfig,
          useValue: config
        }
      ]
    };
  }
}
