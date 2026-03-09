import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { dbxMapboxColoredDotStyle, type DbxMapboxMarkerFactory, DbxMapboxMarkersComponent } from '@dereekb/dbx-web/mapbox';
import { type Maybe, type LatLngTuple } from '@dereekb/util';

export const EXAMPLE_RANDOM_MAPBOX_MARKER_STYLE = dbxMapboxColoredDotStyle('white', 'black');

export const EXAMPLE_RANDOM_MAPBOX_MARKER_FACTORY: DbxMapboxMarkerFactory<LatLngTuple> = (latLng, i) => ({
  id: `r${i}`,
  icon: 'shuffle',
  label: `R${i}`,
  latLng,
  size: 'small',
  style: EXAMPLE_RANDOM_MAPBOX_MARKER_STYLE
});

@Component({
  selector: 'doc-extension-mapbox-markers-example',
  template: `
    <dbx-mapbox-markers [data]="locations()" [markerFactory]="markerFactory"></dbx-mapbox-markers>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxMapboxMarkersComponent]
})
export class DocExtensionMapboxMarkersExampleComponent {
  readonly locations = input<Maybe<LatLngTuple[]>>();

  readonly markerFactory = EXAMPLE_RANDOM_MAPBOX_MARKER_FACTORY;
}
