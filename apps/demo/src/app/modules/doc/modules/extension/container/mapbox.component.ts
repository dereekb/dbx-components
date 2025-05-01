import { latLngPoint, latLngString, LatLngTuple, Maybe, Pixels, randomLatLngFactory, range, latLngTuple, randomFromArrayFactory, isEvenNumber, randomBoolean } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { mapboxLatLngField, mapboxZoomField } from '@dereekb/dbx-form/mapbox';
import { DbxMapboxMapStore } from 'packages/dbx-web/mapbox/src/lib/mapbox.store';
import { KnownMapboxStyle, DbxMapboxLayoutSide, DbxMapboxMarker, DbxMapboxMarkerFactory, dbxMapboxColoredDotStyle, filterByMapboxViewportBound, DbxMapboxChangeService, MapboxFitPositions, DbxMapboxInjectionStore, DbxMapboxModule } from '@dereekb/dbx-web/mapbox';
import { shareReplay, BehaviorSubject, map, Observable, combineLatest, of, first } from 'rxjs';
import { DocExtensionMapboxContentExampleComponent } from '../component/mapbox.content.example.component';
import { DbxThemeColor, DBX_THEME_COLORS } from '@dereekb/dbx-web';
import { tapDetectChanges } from '@dereekb/dbx-core';
import { EXAMPLE_RANDOM_MAPBOX_MARKER_FACTORY, DocExtensionMapboxMarkersExampleComponent } from '../component/mapbox.markers.example.component';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { MatTabGroup, MatTab, MatTabContent } from '@angular/material/tabs';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxMapboxLayoutComponent } from '../../../../../../../../../packages/dbx-web/mapbox/src/lib/mapbox.layout.component';
import { DbxMapboxLayoutVirtualResizeSyncComponent } from '../../../../../../../../../packages/dbx-web/mapbox/src/lib/mapbox.layout.resize.sync.directive';
import { MapComponent } from 'ngx-mapbox-gl';
import { DbxMapboxMapDirective } from '../../../../../../../../../packages/dbx-web/mapbox/src/lib/mapbox.store.map.directive';
import { NgFor, NgIf, AsyncPipe, JsonPipe } from '@angular/common';
import { DbxMapboxMarkerComponent } from '../../../../../../../../../packages/dbx-web/mapbox/src/lib/mapbox.marker.component';
import { DbxMapboxMarkersComponent } from '../../../../../../../../../packages/dbx-web/mapbox/src/lib/mapbox.markers.component';
import { DbxMapboxMenuComponent } from '../../../../../../../../../packages/dbx-web/mapbox/src/lib/mapbox.menu.component';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { DbxBarDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/bar/bar.directive';
import { FlexModule } from '@ngbracket/ngx-layout/flex';
import { DbxLabelBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/label.block.component';
import { MatButton } from '@angular/material/button';
import { DbxDetailBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/detail.block.component';
import { DocFormExampleComponent } from '../../form/component/example.form.component';
import { DbxFormlyFieldsContextDirective } from '../../../../../../../../../packages/dbx-form/src/lib/formly/formly.context.directive';
import { DbxFormSourceDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.input.directive';
import { DbxMapboxInjectionComponent } from '../../../../../../../../../packages/dbx-web/mapbox/src/lib/mapbox.injection.component';
import { DbxMapboxMapStoreInjectionBlockDirective } from '../../../../../../../../../packages/dbx-web/mapbox/src/lib/mapbox.store.provide';

@Component({
    templateUrl: './mapbox.component.html',
    providers: [DbxMapboxMapStore, DbxMapboxModule, DbxMapboxInjectionStore, DbxMapboxChangeService],
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureDerivedComponent, MatTabGroup, MatTab, MatTabContent, DocFeatureExampleComponent, DbxMapboxLayoutComponent, DbxMapboxLayoutVirtualResizeSyncComponent, MapComponent, DbxMapboxMapDirective, NgFor, DbxMapboxMarkerComponent, DbxMapboxMarkersComponent, NgIf, DocExtensionMapboxMarkersExampleComponent, DbxMapboxMenuComponent, MatMenuTrigger, DbxBarDirective, FlexModule, DbxLabelBlockComponent, MatButton, DbxDetailBlockComponent, MatMenu, MatMenuItem, DocFormExampleComponent, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, DbxMapboxInjectionComponent, DbxMapboxMapStoreInjectionBlockDirective, AsyncPipe, JsonPipe]
})
export class DocExtensionMapboxComponent implements OnInit, OnDestroy {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);
  readonly cdRef = inject(ChangeDetectorRef);

  drawerIsOpen = false;

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
  readonly rawBound$ = this.dbxMapboxMapStore.rawBound$;
  readonly bound$ = this.dbxMapboxMapStore.bound$;
  readonly boundSizing$ = this.dbxMapboxMapStore.boundSizing$;
  readonly mapCanvasSize$ = this.dbxMapboxMapStore.mapCanvasSize$;
  readonly virtualMapCanvasSize$ = this.dbxMapboxMapStore.virtualMapCanvasSize$;
  readonly virtualBound$ = this.dbxMapboxMapStore.virtualBound$;

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

  readonly boundNow$ = this.dbxMapboxMapStore.rawBoundNow$;
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
      description: 'This is a coordinate picker synchronized with the big map. Click on the map to set a location.',
      latLngConfig: {
        precision: 3
      },
      selectLocationOnMapDrag: false,
      selectLocationOnMapClick: true,
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

  onOpenedChange(toggle: boolean) {
    this.drawerIsOpen = toggle;
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
    this.menuValue = value;
  }
}
