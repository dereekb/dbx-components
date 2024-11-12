import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { shareReplay, map, Observable, combineLatest } from 'rxjs';
import { DbxMapboxMarker } from '@dereekb/dbx-web/mapbox';
import { DbxFormMapboxLatLngFieldComponent } from './latlng.field.component';
import { Maybe } from '@dereekb/util';

@Component({
  template: `
    <dbx-mapbox-marker [marker]="marker$ | async"></dbx-mapbox-marker>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormMapboxLatLngFieldMarkerComponent {
  readonly fieldComponent = inject(DbxFormMapboxLatLngFieldComponent);

  readonly marker$: Observable<Maybe<DbxMapboxMarker>> = combineLatest([this.fieldComponent.latLng$, this.fieldComponent.markerConfig$]).pipe(
    map(([latLng, markerConfig]) => {
      if (markerConfig !== false) {
        return { latLng, ...markerConfig };
      } else {
        return undefined;
      }
    }),
    shareReplay(1)
  );
}
