import { latLngString, LatLngTuple, Maybe, randomFromArrayFactory } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { mapboxLatLngField } from '@dereekb/dbx-form/mapbox';
import { DbxMapboxMapStore } from 'packages/dbx-web/mapbox/src/lib/mapbox.store';
import { KnownMapboxStyle, DbxMapboxLayoutSide } from '@dereekb/dbx-web/mapbox';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { DocExtensionMapboxContentExampleComponent } from '../component/mapbox.content.example.component';
import { DbxThemeColor } from '@dereekb/dbx-web';

@Component({
  templateUrl: './mapbox.component.html',
  providers: [DbxMapboxMapStore]
})
export class DocExtensionMapboxComponent implements OnInit, OnDestroy {
  private _side = new BehaviorSubject<Maybe<DbxMapboxLayoutSide>>(undefined);
  readonly side$ = this._side.asObservable();

  private _open = new BehaviorSubject<Maybe<boolean>>(undefined);
  readonly open$ = this._open.asObservable();

  private _color = new BehaviorSubject<Maybe<DbxThemeColor>>(undefined);
  readonly color$: Observable<Maybe<DbxThemeColor>> = this._color.asObservable();

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

  ngOnInit(): void {
    this.dbxMapboxMapStore.setContent({
      componentClass: DocExtensionMapboxContentExampleComponent
    });
  }

  ngOnDestroy(): void {
    this._open.complete();
    this._color.complete();
  }

  addDrawerContent() {
    this.dbxMapboxMapStore.setContent({
      componentClass: DocExtensionMapboxContentExampleComponent
    });
  }

  clearDrawerContent() {
    this.dbxMapboxMapStore.clearContent();
  }

  openDrawer() {
    this._open.next(true);
  }

  closeDrawer() {
    this._open.next(false);
  }

  leftDrawer() {
    this._side.next('left');
  }

  rightDrawer() {
    this._side.next('right');
  }

  changeDrawerColor() {
    this._color.next(randomFromArrayFactory<DbxThemeColor>((['primary', 'accent', 'background', 'warn'] as DbxThemeColor[]).filter((x) => x !== this._color.value))());
  }

  centerAustin() {
    this.dbxMapboxMapStore.jumpTo({ center: [30.269026910097345, -97.74083986490928] });
  }

  centerBryan() {
    const center: LatLngTuple = [30.599056767713982, -96.38305877734588];
    this.dbxMapboxMapStore.flyTo({ center });
  }

  centerDenver() {
    const center: LatLngTuple = [39.76501871707782, -104.90412501004826];
    this.dbxMapboxMapStore.easeTo({ to: { center, zoom: 9 } });
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
