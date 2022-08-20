import { latLngString, LatLngTuple } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { mapboxLatLngField } from '@dereekb/dbx-form/mapbox';
import { DbxMapboxMapStore } from 'packages/dbx-web/mapbox/src/lib/mapbox.store';
import { KnownMapboxStyle } from '@dereekb/dbx-web/mapbox';
import { map } from 'rxjs';

@Component({
  templateUrl: './mapbox.component.html',
  providers: [DbxMapboxMapStore]
})
export class DocExtensionMapboxComponent {
  readonly mapService$ = this.dbxMapboxMapStore.mapService$;
  readonly mapInstance$ = this.dbxMapboxMapStore.mapInstance$;
  readonly moveState$ = this.dbxMapboxMapStore.moveState$;
  readonly zoomState$ = this.dbxMapboxMapStore.zoomState$;
  readonly rotateState$ = this.dbxMapboxMapStore.rotateState$;
  readonly lifecycleState$ = this.dbxMapboxMapStore.lifecycleState$;
  readonly zoom$ = this.dbxMapboxMapStore.zoom$;
  readonly zoomNow$ = this.dbxMapboxMapStore.zoomNow$;
  readonly center$ = this.dbxMapboxMapStore.center$;
  readonly centerNow$ = this.dbxMapboxMapStore.centerNow$;
  readonly pitch$ = this.dbxMapboxMapStore.pitch$;
  readonly pitchNow$ = this.dbxMapboxMapStore.pitchNow$;
  readonly bearing$ = this.dbxMapboxMapStore.bearing$;
  readonly bearingNow$ = this.dbxMapboxMapStore.bearingNow$;
  readonly bound$ = this.dbxMapboxMapStore.bound$;
  readonly boundNow$ = this.dbxMapboxMapStore.boundNow$;
  readonly click$ = this.dbxMapboxMapStore.clickEvent$.pipe(map((x) => x?.lngLat.toArray()));
  readonly doubleClick$ = this.dbxMapboxMapStore.doubleClickEvent$.pipe(map((x) => x?.lngLat.toArray()));

  readonly defaultLatLngFieldValue = {
    latLng: latLngString(30.5989668, -96.3831949),
    latLngDisabled: latLngString(30.5989668, -96.3831949)
  };

  readonly mapboxLatLngField: FormlyFieldConfig[] = [
    mapboxLatLngField({
      key: 'latLng',
      description: 'This is a coordinate picker.'
    }),
    mapboxLatLngField({
      key: 'latLngDisabled',
      description: 'This is a read only coordinate picker.',
      readonly: true
    })
  ];

  constructor(readonly dbxMapboxMapStore: DbxMapboxMapStore) {}

  centerAustin() {
    this.dbxMapboxMapStore.jumpTo({ center: [30.269026910097345, -97.74083986490928] });
  }

  centerBryan() {
    const center: LatLngTuple = [30.599056767713982, -96.38305877734588];
    this.dbxMapboxMapStore.flyTo({ center });
  }

  centerDenver() {
    const center: LatLngTuple = [39.76501871707782, -104.90412501004826];
    this.dbxMapboxMapStore.easeTo({ to: { center } });
  }

  resetBearing() {
    this.dbxMapboxMapStore.resetPitchAndBearing();
  }

  snapToNorth() {
    this.dbxMapboxMapStore.snapToNorth();
  }

  resetNorthPitch() {
    this.dbxMapboxMapStore.resetNorthPitch();
  }

  rotateToSouth() {
    this.dbxMapboxMapStore.rotateTo(-180);
  }

  useStreetsMap() {
    this.dbxMapboxMapStore.setStyle('mapbox://styles/mapbox/streets-v11' as KnownMapboxStyle);
  }

  useDarkMap() {
    this.dbxMapboxMapStore.setStyle('mapbox://styles/mapbox/dark-v10' as KnownMapboxStyle);
  }

  useSatelliteMap() {
    this.dbxMapboxMapStore.setStyle('mapbox://styles/mapbox/satellite-v9' as KnownMapboxStyle);
  }
}
