import { ChangeDetectionStrategy, Component, Input, OnDestroy, Optional } from '@angular/core';
import { getValueFromGetter, latLngPointFunction } from '@dereekb/util';
import { DbxMapboxChangeService } from './mapbox.change.service';
import { DbxMapboxMarker } from './mapbox.marker';

@Component({
  selector: 'dbx-mapbox-marker',
  template: `
    <mgl-marker [lngLat]="latLng">
      <dbx-anchor [anchor]="anchor">
        <div class="dbx-mapbox-marker" [ngClass]="presentationClasses">
          <div class="dbx-mapbox-marker-icon-content" [ngStyle]="style">
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

    switch (this.presentation) {
      case 'normal':
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
          break;
        }
        break;
    }

    if (!height) {
      height = width;
    }

    const imageInput = this._marker?.image;
    const image = imageInput ? (typeof imageInput === 'string' ? imageInput : getValueFromGetter(imageInput, width)) : undefined;

    const style: any = {
      ...this._marker?.style,
      'background-image': image
    };

    if (width && height) {
      style.width = width + 'px';
      style.height = height + 'px';
      style['font-size'] = width + 'px';
    }

    return style;
  }

  get presentation() {
    return this._marker.presentation ?? 'normal';
  }

  get presentationClasses() {
    const presentation = this.presentation;
    const markerClasses = this._marker.markerClasses;

    let cssClasses: string = '';

    switch (presentation) {
      case 'chip':
      case 'chip-small':
        cssClasses = 'dbx-mapbox-marker-chip dbx-chip mat-standard-chip dbx-bg';

        if (presentation === 'chip-small') {
          cssClasses += ' dbx-chip-small';
        }

        break;
    }

    if (!this.icon) {
      cssClasses += ' dbx-mapbox-marker-no-icon';
    }

    if (markerClasses) {
      cssClasses += ` markerClasses`;
    }

    return cssClasses;
  }

  ngOnDestroy(): void {
    this._dbxMapboxChangeService?.emitMarkerDestroyed();
  }
}
