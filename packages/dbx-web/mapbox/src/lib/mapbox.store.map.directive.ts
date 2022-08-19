import { DbxMapboxService } from './mapbox.service';
import { DbxMapboxMapStore } from './mapbox.store';
import { Directive, Host, OnInit, Optional } from '@angular/core';
import { MapComponent, MapService } from 'ngx-mapbox-gl';
import { latLngTuple } from '@dereekb/util';

/**
 * Directive that configures a MapComponent with content from DbxMapboxService. Connects a host MapService to a parent DbxMapboxMapStore if available.
 */
@Directive({
  selector: '[dbxMapboxMap]'
})
export class DbxMapboxMapDirective implements OnInit {
  constructor(
    //
    @Host() readonly mapService: MapService,
    @Host() readonly mapboxMap: MapComponent,
    readonly dbxMapboxService: DbxMapboxService,
    @Optional() readonly dbxMapboxMapStore: DbxMapboxMapStore
  ) {}

  ngOnInit(): void {
    // style must be provided first before the map will load.
    this.mapboxMap.style = this.dbxMapboxService.defaultStyle;

    if (this.dbxMapboxMapStore) {
      this.dbxMapboxMapStore.setMapService(this.mapService);
      this.dbxMapboxMapStore.setCenter(this.dbxMapboxService.defaultCenter);
      this.dbxMapboxMapStore.setZoom(this.dbxMapboxService.defaultZoom);
    } else {
      this.mapboxMap.zoom = [this.dbxMapboxService.defaultZoom];
      this.mapboxMap.center = latLngTuple(this.dbxMapboxService.defaultCenter);
    }
  }
}
