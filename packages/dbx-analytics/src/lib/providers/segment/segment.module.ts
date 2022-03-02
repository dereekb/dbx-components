import { NgModule, ModuleWithProviders } from '@angular/core';
import { PRELOAD_SEGMENT_TOKEN, SegmentApiService } from './segment.service';

@NgModule({
  declarations: [],
  imports: []
})
export class SegmentModule {

  static forRoot(preloadService?: boolean): ModuleWithProviders<SegmentModule> {
    return {
      ngModule: SegmentModule,
      providers: [
        {
          provide: PRELOAD_SEGMENT_TOKEN,
          useValue: preloadService
        },
        SegmentApiService
      ]
    };
  }

}
