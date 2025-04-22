import { DbxMapboxService } from './mapbox.service';
import { DbxMapboxMapStore } from './mapbox.store';
import { Directive, OnInit, inject } from '@angular/core';
import { MapComponent, MapService } from 'ngx-mapbox-gl';
import { latLngPoint } from '@dereekb/util';

/**
 * Directive that configures a MapComponent with content from DbxMapboxService. Connects a host MapService to a parent DbxMapboxMapStore if available.
 */
@Directive({
  selector: '[dbxMapboxMap]',
  standalone: true
})
export class DbxMapboxMapDirective implements OnInit {
  readonly mapService = inject(MapService, { host: true });
  readonly mapboxMap = inject(MapComponent, { host: true });
  readonly dbxMapboxService = inject(DbxMapboxService);
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore, { optional: true });

  ngOnInit(): void {
    // style must be provided first before the map will load.
    this.mapboxMap.style = this.dbxMapboxService.defaultStyle;
    this.mapboxMap.zoom = this.dbxMapboxService.defaultZoom;
    this.mapboxMap.center = latLngPoint(this.dbxMapboxService.defaultCenter);

    if (this.dbxMapboxMapStore) {
      this.dbxMapboxMapStore.setMapService(this.mapService);
    }
  }
}
