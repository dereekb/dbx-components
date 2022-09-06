import { ChangeDetectionStrategy, Component, Input, OnDestroy, Optional } from '@angular/core';
import { getValueFromGetter, latLngPointFunction, Maybe } from '@dereekb/util';
import { DbxMapboxChangeService } from './mapbox.change.service';
import { DbxMapboxMarker } from './mapbox.marker';

@Component({
  selector: 'dbx-mapbox-marker',
  template: `
    <mgl-marker [lngLat]="latLng">
      <dbx-anchor [anchor]="anchor">
        <div class="dbx-mapbox-marker">
          <div class="dbx-mapbox-marker-content" [ngStyle]="style">
            <mat-icon *ngIf="icon">{{ icon }}</mat-icon>
          </div>
          <div class="dbx-mapbox-marker-label dbx-outlined-text" *ngIf="label">{{ label }}</div>
        </div>
      </dbx-anchor>
    </mgl-marker>
  `,
  styleUrls: ['./mapbox.marker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxMapboxMarkerComponent implements OnDestroy {
  private static _latLngPoint = latLngPointFunction({ wrap: true });

  private _marker!: DbxMapboxMarker;

  constructor(@Optional() private readonly _dbxMapboxChangeService?: DbxMapboxChangeService) {}

  @Input()
  get marker() {
    return this._marker;
  }

  set marker(marker: DbxMapboxMarker) {
    this._marker = marker;
  }

  get latLng() {
    const input = this._marker?.latLng;
    return input ? DbxMapboxMarkerComponent._latLngPoint(input) : undefined;
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
    let width = 0;
    let height = 0;

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

    const style = {
      ...this._marker?.style,
      width: width + 'px',
      height: height + 'px',
      'font-size': width + 'px',
      'background-image': image
    };

    return style;
  }

  ngOnDestroy(): void {
    this._dbxMapboxChangeService?.emitMarkerDestroyed();
  }
}
