import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { DbxBarDirective } from '@dereekb/dbx-web';
import {
  type DbxMapboxCircle,
  type DbxMapboxCircleDisplayConfig,
  DbxMapboxChangeService,
  DbxMapboxCircleComponent,
  DbxMapboxInjectionStore,
  DbxMapboxMapDirective,
  DbxMapboxMapStore,
  type DbxMapboxMarker,
  DbxMapboxMarkerComponent,
  DbxMapboxMenuComponent,
  dbxMapboxColoredDotStyle,
  DEFAULT_DBX_MAPBOX_CIRCLE_COLOR,
  DEFAULT_MAPBOX_LONG_PRESS_DURATION,
  isDbxMapboxLongPressEvent
} from '@dereekb/dbx-web/mapbox';
import { type LatLngPoint, type Maybe, type Milliseconds } from '@dereekb/util';
import { type LngLatLike } from 'mapbox-gl';
import { MapComponent } from 'ngx-mapbox-gl';
import { map } from 'rxjs';

type DocExtensionMapboxLongPressMeasureRadius = Pick<DbxMapboxCircleDisplayConfig, 'radius' | 'radiusUnit' | 'label'>;

const DOC_EXTENSION_MAPBOX_LONG_PRESS_MEASURE_RADII: DocExtensionMapboxLongPressMeasureRadius[] = [
  { radius: 500, radiusUnit: 'm', label: '500 meter radius' },
  { radius: 1, radiusUnit: 'mi', label: '1 mile radius' },
  { radius: 5, radiusUnit: 'mi', label: '5 mile radius' },
  { radius: 10, radiusUnit: 'km', label: '10 km radius' }
];

/**
 * Map whose right-click menu also opens on a long press, for touch screens that cannot right-click.
 *
 * The menu drops a dbx-mapbox-marker pin, or measures a dbx-mapbox-circle radius from the pressed point.
 *
 * Provides its own map store so the duration buttons only change this map.
 */
@Component({
  selector: 'doc-extension-mapbox-long-press-example',
  template: `
    <div class="doc-extension-mapbox-long-press-example-map">
      <mgl-map dbxMapboxMap [center]="center" [zoom]="zoom">
        <dbx-mapbox-circle [circle]="measureCircleSignal()"></dbx-mapbox-circle>
        @if (measureCenterMarkerSignal(); as measureCenterMarker) {
          <dbx-mapbox-marker [marker]="measureCenterMarker"></dbx-mapbox-marker>
        }
        @for (pin of pinsSignal(); track pin.id) {
          <dbx-mapbox-marker [marker]="pin"></dbx-mapbox-marker>
        }
      </mgl-map>
    </div>
    <dbx-mapbox-menu [matMenuTriggerFor]="menu"></dbx-mapbox-menu>
    <mat-menu #menu="matMenu">
      <button mat-menu-item (click)="dropPin()">
        <mat-icon>place</mat-icon>
        <span>Drop Pin Here</span>
      </button>
      <button mat-menu-item (click)="measureFromHere()">
        <mat-icon>straighten</mat-icon>
        <span>Measure From Here</span>
      </button>
    </mat-menu>
    <dbx-bar>
      @for (duration of durations; track duration) {
        <button mat-button [disabled]="enabledSignal() && durationSignal() === duration" (click)="setDuration(duration)">Hold {{ duration / 1000 }}s</button>
      }
      <button mat-button (click)="toggleEnabled()">{{ enabledSignal() ? 'Turn Off' : 'Turn On' }}</button>
      <span class="dbx-hint">{{ enabledSignal() ? 'Long press: ' + durationSignal() / 1000 + 's' : 'Long press off; right-click only' }}</span>
    </dbx-bar>
    <dbx-bar>
      <span class="dbx-hint">Measure radius:</span>
      @for (radius of measureRadii; track radius.label) {
        <button mat-button [disabled]="measureRadiusSignal() === radius" (click)="measureRadiusSignal.set(radius)">{{ radius.label }}</button>
      }
      <span class="dbx-spacer"></span>
      <button mat-button [disabled]="!pinsSignal().length && !measureCenterSignal()" (click)="clearMap()">Clear Map</button>
    </dbx-bar>
    <p class="dbx-hint">Last menu item: {{ pickedMenuItemSignal() ?? 'none' }}</p>
    <pre>{{ lastEventSignal() | json }}</pre>
  `,
  styles: `
    .doc-extension-mapbox-long-press-example-map {
      height: 480px;
      overflow: hidden;
      border-radius: var(--mat-sys-corner-large);
    }
  `,
  providers: [DbxMapboxMapStore, DbxMapboxInjectionStore, DbxMapboxChangeService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapComponent, DbxMapboxMapDirective, DbxMapboxMenuComponent, DbxMapboxMarkerComponent, DbxMapboxCircleComponent, MatMenuTrigger, MatMenu, MatMenuItem, MatIcon, DbxBarDirective, MatButton, JsonPipe]
})
export class DocExtensionMapboxLongPressExampleComponent {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);

  readonly center: LngLatLike = [-97.7566, 30.2712];
  readonly zoom: [number] = [13];
  readonly durations: Milliseconds[] = [1000, 2000, 3000];
  readonly measureRadii = DOC_EXTENSION_MAPBOX_LONG_PRESS_MEASURE_RADII;

  readonly durationSignal = signal<Milliseconds>(DEFAULT_MAPBOX_LONG_PRESS_DURATION);
  readonly enabledSignal = signal(true);
  readonly pickedMenuItemSignal = signal<Maybe<string>>(undefined);
  readonly pinsSignal = signal<DbxMapboxMarker[]>([]);
  readonly measureCenterSignal = signal<Maybe<LatLngPoint>>(undefined);
  readonly measureRadiusSignal = signal<DocExtensionMapboxLongPressMeasureRadius>(DOC_EXTENSION_MAPBOX_LONG_PRESS_MEASURE_RADII[1]);

  readonly measureCircleSignal = computed<Maybe<DbxMapboxCircle>>(() => {
    const latLng = this.measureCenterSignal();
    const measureRadius = this.measureRadiusSignal();
    return latLng ? { latLng, ...measureRadius } : undefined;
  });

  readonly measureCenterMarkerSignal = computed<Maybe<DbxMapboxMarker>>(() => {
    const latLng = this.measureCenterSignal();
    return latLng ? { id: 'measure-center', latLng, size: 'small', icon: 'my_location', style: dbxMapboxColoredDotStyle(DEFAULT_DBX_MAPBOX_CIRCLE_COLOR, 'white') } : undefined;
  });

  /**
   * Where the menu was last opened, by a right-click or a long press.
   */
  readonly menuLatLngSignal = toSignal(this.dbxMapboxMapStore.rightClickEvent$.pipe(map((event): Maybe<LatLngPoint> => (event ? { lat: event.lngLat.lat, lng: event.lngLat.lng } : undefined))));

  readonly lastEventSignal = toSignal(
    this.dbxMapboxMapStore.rightClickEvent$.pipe(
      map((event) => {
        let result: Maybe<object>;

        if (event) {
          result = {
            kind: isDbxMapboxLongPressEvent(event) ? `long press (${event.source}, ${event.duration}ms)` : 'right-click',
            lngLat: event.lngLat.toArray(),
            point: { x: Math.round(event.point.x), y: Math.round(event.point.y) }
          };
        }

        return result;
      })
    )
  );

  setDuration(duration: Milliseconds) {
    this.durationSignal.set(duration);
    this.enabledSignal.set(true);
    this.dbxMapboxMapStore.setLongPressConfig({ duration });
  }

  toggleEnabled() {
    const enabled = !this.enabledSignal();
    this.enabledSignal.set(enabled);
    this.dbxMapboxMapStore.setLongPressConfig(enabled ? { duration: this.durationSignal() } : false);
  }

  dropPin() {
    const latLng = this.menuLatLngSignal();
    this.pickedMenuItemSignal.set('Drop Pin Here');

    if (latLng) {
      this.pinsSignal.update((pins) => {
        const number = pins.length + 1;
        return [...pins, { id: `pin-${number}`, latLng, icon: 'place', label: `Pin ${number}`, style: dbxMapboxColoredDotStyle('#d93025', 'white') }];
      });
    }
  }

  measureFromHere() {
    const latLng = this.menuLatLngSignal();
    this.pickedMenuItemSignal.set('Measure From Here');

    if (latLng) {
      this.measureCenterSignal.set(latLng);
    }
  }

  clearMap() {
    this.pinsSignal.set([]);
    this.measureCenterSignal.set(undefined);
  }
}
