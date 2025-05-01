import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { dbxMapboxColoredDotStyle, DbxMapboxMarkerFactory } from '@dereekb/dbx-web/mapbox';
import { type Maybe, LatLngTuple } from '@dereekb/util';
import { DbxMapboxMarkersComponent } from '@dereekb/dbx-web';

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
    <dbx-mapbox-markers [data]="locations" [markerFactory]="markerFactory"></dbx-mapbox-markers>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxMapboxMarkersComponent]
})
export class DocExtensionMapboxMarkersExampleComponent {
  @Input()
  locations?: Maybe<LatLngTuple[]>;

  readonly markerFactory = EXAMPLE_RANDOM_MAPBOX_MARKER_FACTORY;
}
