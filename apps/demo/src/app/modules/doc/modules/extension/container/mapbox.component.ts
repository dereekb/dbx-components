import { latLngPoint, latLngString, type LatLngTuple, type Maybe, type Pixels, randomLatLngFactory, range, latLngTuple, randomFromArrayFactory, isEvenNumber, randomBoolean } from '@dereekb/util';
import { Component, type OnInit, inject, ChangeDetectionStrategy, viewChild, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { dbxForgeMapboxLatLngField, dbxForgeMapboxZoomField } from '@dereekb/dbx-form/mapbox';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { DocFormForgeExampleComponent } from '../../form/component/forge.example.form.component';
import { DbxMapboxMapStore } from 'packages/dbx-web/mapbox/src/lib/mapbox.store';
import {
  type KnownMapboxStyle,
  type DbxMapboxLayoutSide,
  type DbxMapboxMarker,
  type DbxMapboxMarkerFactory,
  dbxMapboxColoredDotStyle,
  filterByMapboxViewportBound,
  DbxMapboxChangeService,
  type MapboxFitPositions,
  DbxMapboxInjectionStore,
  DbxMapboxModule,
  DbxMapboxInjectionComponent,
  DbxMapboxLayoutComponent,
  DbxMapboxLayoutVirtualResizeSyncComponent,
  DbxMapboxMapDirective,
  DbxMapboxMapStoreInjectionBlockDirective,
  DbxMapboxMarkerComponent,
  DbxMapboxMarkersComponent,
  DbxMapboxMenuComponent
} from '@dereekb/dbx-web/mapbox';
import { shareReplay, BehaviorSubject, map, type Observable, combineLatest, of, first } from 'rxjs';
import { DocExtensionMapboxContentExampleComponent } from '../component/mapbox.content.example.component';
import { type DbxThemeColor, DBX_THEME_COLORS, DbxContentContainerDirective, DbxBarDirective, DbxLabelBlockComponent, DbxDetailBlockComponent } from '@dereekb/dbx-web';
import { EXAMPLE_RANDOM_MAPBOX_MARKER_FACTORY, DocExtensionMapboxMarkersExampleComponent } from '../component/mapbox.markers.example.component';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { MatTabGroup, MatTab, MatTabContent } from '@angular/material/tabs';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MapComponent } from 'ngx-mapbox-gl';
import { JsonPipe } from '@angular/common';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { FlexModule } from '@ngbracket/ngx-layout/flex';
import { MatButton } from '@angular/material/button';
import { DbxFormSourceDirective } from '@dereekb/dbx-form';
import { completeOnDestroy } from '@dereekb/dbx-core';

@Component({
  templateUrl: './mapbox.component.html',
  providers: [DbxMapboxMapStore, DbxMapboxModule, DbxMapboxInjectionStore, DbxMapboxChangeService],
  standalone: true,
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocFeatureDerivedComponent,
    MatTabGroup,
    MatTab,
    MatTabContent,
    DocFeatureExampleComponent,
    DbxMapboxLayoutComponent,
    DbxMapboxLayoutVirtualResizeSyncComponent,
    MapComponent,
    DbxMapboxMapDirective,
    DbxMapboxMarkerComponent,
    DbxMapboxMarkersComponent,
    DocExtensionMapboxMarkersExampleComponent,
    DbxMapboxMenuComponent,
    MatMenuTrigger,
    DbxBarDirective,
    FlexModule,
    DbxLabelBlockComponent,
    MatButton,
    DbxDetailBlockComponent,
    MatMenu,
    MatMenuItem,
    DbxFormSourceDirective,
    DbxMapboxInjectionComponent,
    DbxMapboxMapStoreInjectionBlockDirective,
    JsonPipe,
    DocFormForgeExampleComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionMapboxComponent implements OnInit {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);

  readonly mapboxLayoutChild = viewChild(DbxMapboxLayoutComponent);
  readonly drawerIsOpenSignal = computed(() => this.mapboxLayoutChild()?.isOpenAndHasContentSignal() ?? false);

  private _side = completeOnDestroy(new BehaviorSubject<Maybe<DbxMapboxLayoutSide>>(undefined));
  readonly side$ = this._side.asObservable();
  readonly sideSignal = toSignal(this.side$, { initialValue: undefined });

  private _open = completeOnDestroy(new BehaviorSubject<Maybe<boolean>>(undefined));
  readonly open$ = this._open.asObservable();
  readonly openSignal = toSignal(this.open$, { initialValue: undefined });

  private _color = completeOnDestroy(new BehaviorSubject<Maybe<DbxThemeColor>>(undefined));
  readonly color$: Observable<Maybe<DbxThemeColor>> = this._color.asObservable();
  readonly colorSignal = toSignal(this.color$, { initialValue: undefined });

  private _showMarkers = completeOnDestroy(new BehaviorSubject<boolean>(true));
  readonly showMarkers$ = this._showMarkers.asObservable();
  readonly showMarkersSignal = toSignal(this.showMarkers$, { initialValue: true });

  readonly menuValueSignal = signal<Maybe<number>>(undefined);

  readonly mapService$ = this.dbxMapboxMapStore.mapService$;
  readonly mapServiceSignal = toSignal(this.mapService$, { initialValue: undefined });
  readonly mapInstance$ = this.dbxMapboxMapStore.mapInstance$;
  readonly mapInstanceSignal = toSignal(this.mapInstance$, { initialValue: undefined });
  readonly moveState$ = this.dbxMapboxMapStore.moveState$;
  readonly moveStateSignal = toSignal(this.moveState$, { initialValue: undefined });
  readonly zoomState$ = this.dbxMapboxMapStore.zoomState$;
  readonly zoomStateSignal = toSignal(this.zoomState$, { initialValue: undefined });
  readonly rotateState$ = this.dbxMapboxMapStore.rotateState$;
  readonly rotateStateSignal = toSignal(this.rotateState$, { initialValue: undefined });
  readonly lifecycleState$ = this.dbxMapboxMapStore.lifecycleState$;
  readonly lifecycleStateSignal = toSignal(this.lifecycleState$, { initialValue: undefined });
  readonly zoom$ = this.dbxMapboxMapStore.zoom$;
  readonly zoomSignal = toSignal(this.zoom$, { initialValue: undefined });
  readonly zoomNow$ = this.dbxMapboxMapStore.zoomNow$;
  readonly zoomNowSignal = toSignal(this.zoomNow$, { initialValue: undefined });
  readonly center$ = this.dbxMapboxMapStore.center$;
  readonly centerSignal = toSignal(this.center$, { initialValue: undefined });
  readonly centerNow$ = this.dbxMapboxMapStore.centerNow$;
  readonly centerNowSignal = toSignal(this.centerNow$, { initialValue: undefined });
  readonly pitch$ = this.dbxMapboxMapStore.pitch$;
  readonly pitchSignal = toSignal(this.pitch$, { initialValue: undefined });
  readonly pitchNow$ = this.dbxMapboxMapStore.pitchNow$;
  readonly pitchNowSignal = toSignal(this.pitchNow$, { initialValue: undefined });
  readonly bearing$ = this.dbxMapboxMapStore.bearing$;
  readonly bearingSignal = toSignal(this.bearing$, { initialValue: undefined });
  readonly bearingNow$ = this.dbxMapboxMapStore.bearingNow$;
  readonly bearingNowSignal = toSignal(this.bearingNow$, { initialValue: undefined });
  readonly rawBound$ = this.dbxMapboxMapStore.rawBound$;
  readonly rawBoundSignal = toSignal(this.rawBound$, { initialValue: undefined });
  readonly bound$ = this.dbxMapboxMapStore.bound$;
  readonly boundSignal = toSignal(this.bound$, { initialValue: undefined });
  readonly boundSizing$ = this.dbxMapboxMapStore.boundSizing$;
  readonly boundSizingSignal = toSignal(this.boundSizing$, { initialValue: undefined });
  readonly mapCanvasSize$ = this.dbxMapboxMapStore.mapCanvasSize$;
  readonly mapCanvasSizeSignal = toSignal(this.mapCanvasSize$, { initialValue: undefined });
  readonly virtualMapCanvasSize$ = this.dbxMapboxMapStore.virtualMapCanvasSize$;
  readonly virtualMapCanvasSizeSignal = toSignal(this.virtualMapCanvasSize$, { initialValue: undefined });
  readonly virtualBound$ = this.dbxMapboxMapStore.virtualBound$;
  readonly virtualBoundSignal = toSignal(this.virtualBound$, { initialValue: undefined });

  readonly boundSizingRatio$ = combineLatest([this.boundSizing$, this.mapCanvasSize$]).pipe(
    map(([point, vector]) => ({ x: point.lng / vector.x, y: point.lat / vector.y })),
    shareReplay(1)
  );
  readonly boundSizingRatioSignal = toSignal(this.boundSizingRatio$, { initialValue: undefined });

  readonly viewportBoundFunction$ = this.dbxMapboxMapStore.viewportBoundFunction$;
  readonly viewportBoundFunctionCalc$ = combineLatest([this.center$, this.zoom$, this.viewportBoundFunction$]).pipe(
    map(([c, z, fn]) => fn({ center: c, zoom: z })),
    shareReplay(1)
  );
  readonly viewportBoundFunctionCalcSignal = toSignal(this.viewportBoundFunctionCalc$, { initialValue: undefined });

  readonly boundNow$ = this.dbxMapboxMapStore.rawBoundNow$;
  readonly boundNowSignal = toSignal(this.boundNow$, { initialValue: undefined });
  readonly click$ = this.dbxMapboxMapStore.clickEvent$.pipe(map((x) => x?.lngLat.toArray()));
  readonly clickSignal = toSignal(this.click$, { initialValue: undefined });
  readonly doubleClick$ = this.dbxMapboxMapStore.doubleClickEvent$.pipe(map((x) => x?.lngLat.toArray()));
  readonly doubleClickSignal = toSignal(this.doubleClick$, { initialValue: undefined });
  readonly rightClick$ = this.dbxMapboxMapStore.rightClickEvent$.pipe(map((x) => ({ loc: x?.lngLat.toArray(), x: x?.originalEvent?.pageX, y: x?.originalEvent?.pageY })));
  readonly rightClickSignal = toSignal(this.rightClick$, { initialValue: undefined });
  readonly boundWrapsAroundWorld$ = this.dbxMapboxMapStore.boundWrapsAroundWorld$;
  readonly boundWrapsAroundWorldSignal = toSignal(this.boundWrapsAroundWorld$, { initialValue: undefined });
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

  readonly forgeMapboxLatLngFieldConfig: FormConfig = {
    fields: [
      dbxForgeMapboxLatLngField({
        key: 'latLng',
        description: 'This is a coordinate picker.'
      }),
      dbxForgeMapboxLatLngField({
        key: 'latLngDisabled',
        description: 'This is a read only coordinate picker. It will also re-center the map to the point after 3 seconds.',
        readonly: true,
        recenterTime: 3000
      })
    ]
  } as FormConfig;

  readonly forgeMapboxZoomFieldConfig: FormConfig = {
    fields: [
      dbxForgeMapboxZoomField({
        key: 'zoom',
        description: 'This is a zoom picker.',
        center: latLngPoint(30.5989668, -96.3831949)
      }),
      dbxForgeMapboxZoomField({
        key: 'zoomDisabled',
        description: 'This is a read only zoom picker.',
        center: latLngPoint(30.5989668, -96.3831949),
        readonly: true
      })
    ]
  } as FormConfig;

  readonly mapboxLatLngAndZoomConfig: FormConfig = {
    fields: [
      dbxForgeMapboxLatLngField({
        key: 'latLng',
        description: 'This is a coordinate picker synchronized with the big map. Click on the map to set a location.',
        latLngConfig: {
          precision: 3
        },
        selectLocationOnMapDrag: false,
        selectLocationOnMapClick: true,
        showMap: false
      }),
      dbxForgeMapboxZoomField({
        key: 'zoom',
        description: 'This is a zoom picker synchronized with the big map. It has a min and max zoom.',
        showMap: false,
        zoomStep: 0.5,
        minZoom: 6,
        maxZoom: 15
      })
    ]
  } as FormConfig;

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

  readonly mapboxMarkersData: LatLngTuple[] = range(0, 9).map((x) => [40 + x * 5, -100]);
  readonly mapboxMarkerPlainDotStyle = dbxMapboxColoredDotStyle('', '');
  readonly mapboxMarkerDotStyle = dbxMapboxColoredDotStyle('red', 'white');
  readonly mapboxMarkerFactory: DbxMapboxMarkerFactory<LatLngTuple> = (latLng, i) => ({
    id: `m${i}`,
    presentation: i % 3 ? 'chip' : 'chip-small',
    icon: isEvenNumber(i) ? 'arrow_upward' : undefined,
    label: i % 4 ? `Item ${i}` : undefined,
    latLng,
    size: 'small',
    style: randomBoolean(20) ? this.mapboxMarkerPlainDotStyle : this.mapboxMarkerDotStyle
  });

  private _addedMarkersData = completeOnDestroy(new BehaviorSubject<LatLngTuple[]>([]));
  readonly addedMapboxMarkersData$ = this._addedMarkersData.asObservable();
  readonly addedMapboxMarkersDataSignal = toSignal(this.addedMapboxMarkersData$, { initialValue: [] as LatLngTuple[] });

  readonly markersInView$ = combineLatest([
    // default items
    of([...this.mapboxDemoMarkers, ...this.mapboxMarkersData.map(this.mapboxMarkerFactory)].map((x) => ({ ...x, zoom: 10 }))),
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
  readonly markersInViewSignal = toSignal(this.markersInView$, { initialValue: undefined });

  private _setDrawerContentToExample() {
    this.dbxMapboxMapStore.setDrawerContent({
      componentClass: DocExtensionMapboxContentExampleComponent
    });
  }

  ngOnInit(): void {
    this._setDrawerContentToExample();
  }

  addDrawerContent() {
    this._setDrawerContentToExample();
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
    this._setDrawerContentToExample();
  }

  toggleMarkers() {
    this._showMarkers.next(!this._showMarkers.value);
  }

  clearDrawerContent() {
    this.dbxMapboxMapStore.clearDrawerContent();
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
        map((positions) => ({ positions, options: { minZoom: 8, padding: 20 } }) as MapboxFitPositions),
        first()
      )
    );
  }

  changeDrawerButtonColor() {
    this._color.next(randomFromArrayFactory<DbxThemeColor>(DBX_THEME_COLORS.filter((x) => x !== this._color.value))());
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
    this.menuValueSignal.set(value);
  }
}
