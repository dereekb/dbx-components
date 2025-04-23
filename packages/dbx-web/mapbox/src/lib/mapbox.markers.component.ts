import { type Maybe } from '@dereekb/util';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DbxMapboxMarker, DbxMapboxMarkerFactory } from './mapbox.marker';
import { DbxMapboxMarkerComponent } from './mapbox.marker.component';

/**
 * Component used to render a set of DbxMapboxMarker values from the input data and marker factory.
 */
@Component({
  selector: 'dbx-mapbox-markers',
  template: `
    @for (marker of markersSignal(); track trackMarkerById($index, marker)) {
      <dbx-mapbox-marker [marker]="marker"></dbx-mapbox-marker>
    }
  `,
  imports: [DbxMapboxMarkerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxMapboxMarkersComponent<T> {
  readonly data = input.required<Maybe<T[]>>();
  readonly markerFactory = input.required<Maybe<DbxMapboxMarkerFactory<T>>>();

  readonly markersSignal = computed(() => {
    const data = this.data();
    const markerFactory = this.markerFactory();

    if (data?.length && markerFactory) {
      return data.map(markerFactory);
    } else {
      return [];
    }
  });

  trackMarkerById(index: number, marker: DbxMapboxMarker) {
    return marker.id;
  }
}
