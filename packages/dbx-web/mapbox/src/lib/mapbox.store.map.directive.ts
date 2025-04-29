import { DbxMapboxService } from './mapbox.service';
import { DbxMapboxMapStore } from './mapbox.store';
import { Directive, OnInit, inject } from '@angular/core';
import { MAP_COMPONENT_INITIALIZATION_OPTIONS, MapComponent, MapService } from 'ngx-mapbox-gl';

/**
 * Directive that configures a MapComponent with content from DbxMapboxService. Connects a host MapService to a parent DbxMapboxMapStore if available.
 */
@Directive({
  selector: '[dbxMapboxMap]',
  providers: [
    {
      provide: MAP_COMPONENT_INITIALIZATION_OPTIONS,
      useFactory: (dbxMapboxService: DbxMapboxService) => dbxMapboxService.initializationOptions(),
      deps: [DbxMapboxService]
    }
  ],
  standalone: true
})
export class DbxMapboxMapDirective implements OnInit {
  readonly mapService = inject(MapService, { host: true });
  readonly mapboxMap = inject(MapComponent, { host: true });
  readonly dbxMapboxService = inject(DbxMapboxService);
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore, { optional: true });

  ngOnInit(): void {
    if (this.dbxMapboxMapStore) {
      this.dbxMapboxMapStore.setMapService(this.mapService);
    }
  }
}
