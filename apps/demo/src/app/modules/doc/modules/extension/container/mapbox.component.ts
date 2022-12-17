import { latLngPoint, latLngString, LatLngTuple, Maybe, Pixels, randomLatLngFactory, range, latLngTuple, randomFromArrayFactory } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { mapboxLatLngField, mapboxZoomField } from '@dereekb/dbx-form/mapbox';
import { DbxMapboxMapStore } from 'packages/dbx-web/mapbox/src/lib/mapbox.store';
import { KnownMapboxStyle, DbxMapboxLayoutSide, DbxMapboxMarker, DbxMapboxMarkerFactory, dbxMapboxColoredDotStyle, filterByMapboxViewportBound, DbxMapboxChangeService, MapboxFitPositions } from '@dereekb/dbx-web/mapbox';
import { shareReplay, BehaviorSubject, map, Observable, combineLatest, of, first } from 'rxjs';
import { DocExtensionMapboxContentExampleComponent } from '../component/mapbox.content.example.component';
import { DbxThemeColor } from '@dereekb/dbx-web';
import { tapDetectChanges } from '@dereekb/dbx-core';
import { EXAMPLE_RANDOM_MAPBOX_MARKER_FACTORY } from '../component/mapbox.markers.example.component';

@Component({
  templateUrl: './mapbox.component.html',
  providers: [DbxMapboxMapStore, DbxMapboxChangeService]
})
export class DocExtensionMapboxComponent implements OnInit, OnDestroy {
  private _side = new BehaviorSubject<Maybe<DbxMapboxLayoutSide>>(undefined);
  readonly side$ = this._side.asObservable();

  private _open = new BehaviorSubject<Maybe<boolean>>(undefined);
  readonly open$ = this._open.asObservable();

  private _color = new BehaviorSubject<Maybe<DbxThemeColor>>(undefined);
  readonly color$: Observable<Maybe<DbxThemeColor>> = this._color.asObservable();

  private _showMarkers = new BehaviorSubject<boolean>(true);
  readonly showMarkers$ = this._showMarkers.asObservable();

  menuValue?: Maybe<number> = undefined;

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
  readonly boundSizing$ = this.dbxMapboxMapStore.boundSizing$;
  readonly mapCanvasSize$ = this.dbxMapboxMapStore.mapCanvasSize$;

  readonly boundSizingRatio$ = combineLatest([this.boundSizing$, this.mapCanvasSize$]).pipe(
    map(([point, vector]) => ({ x: point.lng / vector.x, y: point.lat / vector.y })),
    tapDetectChanges(this.cdRef),
    shareReplay(1)
  );

  readonly viewportBoundFunction$ = this.dbxMapboxMapStore.viewportBoundFunction$;
  readonly viewportBoundFunctionCalc$ = combineLatest([this.center$, this.zoom$, this.viewportBoundFunction$]).pipe(
    map(([c, z, fn]) => fn({ center: c, zoom: z })),
    tapDetectChanges(this.cdRef),
    shareReplay(1)
  );

  readonly boundNow$ = this.dbxMapboxMapStore.boundNow$;
  readonly click$ = this.dbxMapboxMapStore.clickEvent$.pipe(map((x) => x?.lngLat.toArray()));
  readonly doubleClick$ = this.dbxMapboxMapStore.doubleClickEvent$.pipe(map((x) => x?.lngLat.toArray()));
  readonly rightClick$ = this.dbxMapboxMapStore.rightClickEvent$.pipe(map((x) => ({ loc: x?.lngLat.toArray(), x: x?.originalEvent?.pageX, y: x?.originalEvent?.pageY })));
  readonly boundWrapsAroundWorld$ = this.dbxMapboxMapStore.boundWrapsAroundWorld$;
  readonly margin$ = this.dbxMapboxMapStore.margin$;
  readonly centerGivenMargin$ = this.dbxMapboxMapStore.centerGivenMargin$;

  readonly defaultLatLngFieldValue = {
    latLng: latLngString(30.5989668, -96.3831949),
    latLngDisabled: latLngString(30.5989668, -96.3831949)
  };

  readonly defaultZoomFieldValue = {
    zoom: 10.1234,
    zoomDisabled: 17.123456
  };

  readonly defaultLatLngAndZoomFieldValue = {
    latLng: latLngString(30.5989668, -96.3831949),
    zoom: 10.1234
  };

  readonly mapboxLatLngField: FormlyFieldConfig[] = [
    mapboxLatLngField({
      key: 'latLng',
      description: 'This is a coordinate picker.'
    }),
    mapboxLatLngField({
      key: 'latLngDisabled',
      description: 'This is a read only coordinate picker. It will also re-center the map to the point after 3 seconds.',
      readonly: true,
      recenterTime: 3000
    })
  ];

  readonly mapboxZoomField: FormlyFieldConfig[] = [
    mapboxZoomField({
      key: 'zoom',
      description: 'This is a zoom picker.',
      center: latLngPoint(30.5989668, -96.3831949)
    }),
    mapboxZoomField({
      key: 'zoomDisabled',
      description: 'This is a read only zoom picker.',
      center: latLngPoint(30.5989668, -96.3831949),
      readonly: true
    })
  ];

  readonly mapboxLatLngAndZoomField: FormlyFieldConfig[] = [
    mapboxLatLngField({
      key: 'latLng',
      description: 'This is a coordinate picker synchronized with the big map.',
      latLngConfig: {
        precision: 3
      },
      showMap: false
    }),
    mapboxZoomField({
      key: 'zoom',
      description: 'This is a zoom picker synchronized with the big map. It has a min and max zoom.',
      showMap: false,
      zoomStep: 0.5,
      minZoom: 6,
      maxZoom: 15
    })
  ];

  readonly mapboxDemoMarkers: DbxMapboxMarker[] = [
    {
      id: 'dsst',
      latLng: latLngPoint([30.599056767713982, -96.38305877734588]),
      size: 'small',
      label: 'DSST',
      icon: 'map',
      anchor: {
        onClick: () => {
          this.centerBryan(14);
        }
      },
      style: {
        background: 'red',
        padding: '2px',
        color: 'white',
        'border-radius': '50%'
      }
    },
    {
      id: 'tn',
      icon: 'map',
      latLng: latLngPoint([39.76501871707782, -104.90412501004826]),
      label: 'Teaching Nomad',
      size: 'small',
      anchor: {
        onClick: () => {
          this.centerDenver(14);
        }
      }
    },
    {
      id: 'hs',
      latLng: latLngPoint([30.269026910097345, -97.74083986490928]),
      label: 'HelloSubs',
      size: 'large',
      image: (pixels: Pixels) => `url(https://placekitten.com/g/${pixels}/)`,
      anchor: {
        onClick: () => {
          this.centerAustin(14);
        }
      },
      style: {
        'border-radius': '50%'
      }
    }
  ];

  readonly mapboxMarkersData: LatLngTuple[] = range(0, 3).map((x) => [40 + x * 5, -100]);
  readonly mapboxMarkerDotStyle = dbxMapboxColoredDotStyle('blue', 'white');
  readonly mapboxMarkerFactory: DbxMapboxMarkerFactory<LatLngTuple> = (latLng, i) => ({
    id: `m${i}`,
    icon: 'arrow_upward',
    label: `M${i}`,
    latLng,
    size: 'small',
    style: this.mapboxMarkerDotStyle
  });

  private _addedMarkersData = new BehaviorSubject<LatLngTuple[]>([]);
  readonly addedMapboxMarkersData$ = this._addedMarkersData.asObservable();

  readonly markersInView$ = combineLatest([
    // default items
    of([...this.mapboxDemoMarkers, ...this.mapboxMarkersData.map(this.mapboxMarkerFactory)].map((x, i) => ({ ...x, zoom: 10 }))),
    // added markers
    this.addedMapboxMarkersData$.pipe(map((x) => x.map(EXAMPLE_RANDOM_MAPBOX_MARKER_FACTORY)))
  ]).pipe(
    map(([a, b]) => [...a, ...b]),
    filterByMapboxViewportBound({
      boundFunctionObs: this.dbxMapboxMapStore.viewportBoundFunction$,
      /**
       * Can alternatively use isWithinBoundFunction$ to get items that are entirely contained within the viewport.
       */
      boundDecisionObs: this.dbxMapboxMapStore.overlapsBoundFunction$,
      readValue: (x) => {
        return { center: x.latLng, zoom: (x as { zoom?: number })?.zoom };
      },
      defaultZoom: 8
    }),
    map((x) => x.map((y) => ({ label: y.label, center: y.latLng }))),
    shareReplay(1)
  );

  constructor(readonly dbxMapboxMapStore: DbxMapboxMapStore, readonly cdRef: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.dbxMapboxMapStore.setContent({
      componentClass: DocExtensionMapboxContentExampleComponent
    });
  }

  ngOnDestroy(): void {
    this._side.complete();
    this._open.complete();
    this._color.complete();
    this._addedMarkersData.complete();
    this._showMarkers.complete();
  }

  addDrawerContent() {
    this.dbxMapboxMapStore.setContent({
      componentClass: DocExtensionMapboxContentExampleComponent
    });
  }

  readonly randomLatLngBounds = { sw: { lat: -60 }, ne: { lat: 60 } };

  addRandomMarker() {
    const value = [...this._addedMarkersData.value, latLngTuple(randomLatLngFactory(this.randomLatLngBounds)())];
    this._addedMarkersData.next(value);
  }

  removeRandomMarker() {
    const value = [...this._addedMarkersData.value];
    value.pop();
    this._addedMarkersData.next(value);
  }

  clearRandomMarkers() {
    this._addedMarkersData.next([]);
  }

  removeMarker() {
    this.dbxMapboxMapStore.setContent({
      componentClass: DocExtensionMapboxContentExampleComponent
    });
  }

  toggleMarkers() {
    this._showMarkers.next(!this._showMarkers.value);
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

  fitMapToAddedMarkers() {
    const positions = this.addedMapboxMarkersData$.pipe(
      map((x) => x.map((y) => latLngPoint(y))),
      first()
    );

    this.dbxMapboxMapStore.fitPositions(
      positions.pipe(
        map((positions) => ({ positions, options: { minZoom: 8, padding: 20 } } as MapboxFitPositions)),
        first()
      )
    );
  }

  changeDrawerColor() {
    this._color.next(randomFromArrayFactory<DbxThemeColor>((['primary', 'accent', 'background', 'warn'] as DbxThemeColor[]).filter((x) => x !== this._color.value))());
  }

  centerAustin(zoom?: number) {
    this.dbxMapboxMapStore.jumpTo({ to: { center: [30.269026910097345, -97.74083986490928], zoom } });
  }

  centerBryan(zoom?: number) {
    const center: LatLngTuple = [30.599056767713982, -96.38305877734588];
    this.dbxMapboxMapStore.flyTo({ to: { center, zoom } });
  }

  centerDenver(zoom?: number) {
    const center: LatLngTuple = [39.76501871707782, -104.90412501004826];
    this.dbxMapboxMapStore.easeTo({ to: { center, zoom } });
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

  clickMenuItem(value: number) {
    this.menuValue = value;
  }
}
