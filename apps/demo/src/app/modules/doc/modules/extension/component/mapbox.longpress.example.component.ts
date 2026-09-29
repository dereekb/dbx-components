import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { DbxBarDirective } from '@dereekb/dbx-web';
import { DbxMapboxChangeService, DbxMapboxInjectionStore, DbxMapboxMapDirective, DbxMapboxMapStore, DbxMapboxMenuComponent, DEFAULT_MAPBOX_LONG_PRESS_DURATION, isDbxMapboxLongPressEvent } from '@dereekb/dbx-web/mapbox';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type LngLatLike } from 'mapbox-gl';
import { MapComponent } from 'ngx-mapbox-gl';
import { map } from 'rxjs';

/**
 * Map whose right-click menu also opens on a long press, for touch screens that cannot right-click.
 *
 * Provides its own map store so the duration buttons only change this map.
 */
@Component({
  selector: 'doc-extension-mapbox-long-press-example',
  template: `
    <div class="doc-extension-mapbox-long-press-example-map">
      <mgl-map dbxMapboxMap [center]="center" [zoom]="zoom"></mgl-map>
    </div>
    <dbx-mapbox-menu [matMenuTriggerFor]="menu"></dbx-mapbox-menu>
    <mat-menu #menu="matMenu">
      <button mat-menu-item (click)="pickMenuItem('Drop Pin Here')">
        <mat-icon>place</mat-icon>
        <span>Drop Pin Here</span>
      </button>
      <button mat-menu-item (click)="pickMenuItem('Measure From Here')">
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
  imports: [MapComponent, DbxMapboxMapDirective, DbxMapboxMenuComponent, MatMenuTrigger, MatMenu, MatMenuItem, MatIcon, DbxBarDirective, MatButton, JsonPipe]
})
export class DocExtensionMapboxLongPressExampleComponent {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);

  readonly center: LngLatLike = [-97.7566, 30.2712];
  readonly zoom: [number] = [13];
  readonly durations: Milliseconds[] = [1000, 2000, 3000];

  readonly durationSignal = signal<Milliseconds>(DEFAULT_MAPBOX_LONG_PRESS_DURATION);
  readonly enabledSignal = signal(true);
  readonly pickedMenuItemSignal = signal<Maybe<string>>(undefined);

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

  pickMenuItem(item: string) {
    this.pickedMenuItemSignal.set(item);
  }
}
