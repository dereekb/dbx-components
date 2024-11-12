import { NgModule, ModuleWithProviders } from '@angular/core';
import { PRELOAD_SEGMENT_TOKEN } from './segment.service';

@NgModule({
  declarations: [],
  imports: []
})
export class DbxAnalyticsSegmentModule {
  static forRoot(preloadService?: boolean): ModuleWithProviders<DbxAnalyticsSegmentModule> {
    return {
      ngModule: DbxAnalyticsSegmentModule,
      providers: [
        {
          provide: PRELOAD_SEGMENT_TOKEN,
          useValue: preloadService
        }
      ]
    };
  }
}
