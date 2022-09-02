import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { FactoryWithRequiredInput, getValueFromGetter, LatLngPointRef, Maybe, Pixels } from '@dereekb/util';

/**
 * DbxMapboxMarkerSize. Numbers are converted to pixels.
 */
export type DbxMapboxMarkerSize = 'small' | 'medium' | 'large' | 'tall' | Pixels;

export interface DbxMapboxMarker extends LatLngPointRef {
  /**
   * icon
   */
  icon?: string;
  /**
   * label
   */
  label?: string;
  /**
   * Image URL
   */
  image?: string | FactoryWithRequiredInput<string, Pixels>;
  /**
   * Size of the marker.
   */
  size?: DbxMapboxMarkerSize;
  /**
   *
   */
  anchor?: ClickableAnchor;
  /**
   * Additional object styling
   */
  style?: object;
}

@Component({
  selector: 'dbx-mapbox-marker',
  template: `
    <mgl-marker *ngIf="marker" [lngLat]="latLng">
      <dbx-anchor [anchor]="anchor">
        <div class="dbx-mapbox-marker">
          <div class="dbx-mapbox-marker-content" [ngStyle]="style">
            <mat-icon *ngIf="icon">{{ icon }}</mat-icon>
          </div>
          <div class="dbx-mapbox-marker-label" *ngIf="label">{{ label }}</div>
        </div>
      </dbx-anchor>
    </mgl-marker>
  `,
  styleUrls: ['./mapbox.marker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxMapboxMarkerComponent {
  private _marker!: Maybe<DbxMapboxMarker>;

  @Input()
  get marker() {
    return this._marker;
  }

  set marker(marker: Maybe<DbxMapboxMarker>) {
    this._marker = marker;
  }

  constructor() {}

  get latLng() {
    return this._marker?.latLng;
  }

  get anchor() {
    return this._marker?.anchor;
  }

  get label() {
    return this._marker?.label;
  }

  get icon() {
    return this._marker?.icon;
  }

  get style() {
    let width: number = 0;
    let height: number = 0;

    const size = this._marker?.size || 'medium';

    if (typeof size === 'number') {
      width = size;
    } else {
      switch (size) {
        case 'small':
          width = 18;
          break;
        case 'medium':
          width = 24;
          break;
        case 'large':
          width = 32;
          break;
        case 'tall':
          width = 24;
          height = 32;
          break;
      }
    }

    if (!height) {
      height = width;
    }

    const imageInput = this._marker?.image;
    const image = imageInput ? (typeof imageInput === 'string' ? imageInput : getValueFromGetter(imageInput, width)) : undefined;

    let style = {
      ...this._marker?.style,
      width: width + 'px',
      height: height + 'px',
      'font-size': width + 'px',
      'background-image': image
    };

    return style;
  }
}
