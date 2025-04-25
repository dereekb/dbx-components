import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { shareReplay, map, Observable, combineLatest } from 'rxjs';
import { DbxMapboxMarker, DbxMapboxMarkerComponent } from '@dereekb/dbx-web/mapbox';
import { DbxFormMapboxLatLngFieldComponent } from './latlng.field.component';
import { type Maybe } from '@dereekb/util';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  template: `
    <dbx-mapbox-marker [marker]="markerSignal()"></dbx-mapbox-marker>
  `,
  imports: [DbxMapboxMarkerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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

  readonly markerSignal = toSignal(this.marker$);
}
