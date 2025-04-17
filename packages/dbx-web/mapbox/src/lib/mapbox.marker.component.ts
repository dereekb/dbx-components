import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input } from '@angular/core';
import { CssClassesArray, getValueFromGetter, latLngPointFunction, spaceSeparatedCssClasses, type Maybe, pushItemOrArrayItemsIntoArray } from '@dereekb/util';
import { DbxMapboxChangeService } from './mapbox.change.service';
import { DbxMapboxMarker } from './mapbox.marker';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import { DbxAnchorComponent } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';
import { NgClass, NgStyle } from '@angular/common';

@Component({
  selector: 'dbx-mapbox-marker',
  template: `
    @if (marker()) {
      <mgl-marker [lngLat]="latLngSignal()">
        <dbx-anchor [anchor]="marker()?.anchor">
          <div class="dbx-mapbox-marker" [ngClass]="presentationCssClassSignal()">
            <div class="dbx-mapbox-marker-icon-content" [ngStyle]="styleSignal()">
              @if (marker()?.icon) {
                <mat-icon>{{ marker()?.icon }}</mat-icon>
              }
            </div>
            @if (marker()?.label) {
              <div class="dbx-mapbox-marker-label dbx-outlined-text">{{ marker()?.label }}</div>
            }
          </div>
        </dbx-anchor>
      </mgl-marker>
    }
  `,
  styleUrls: ['./mapbox.marker.component.scss'],
  imports: [NgxMapboxGLModule, DbxAnchorComponent, MatIconModule, NgStyle, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxMapboxMarkerComponent implements OnDestroy {
  private readonly _dbxMapboxChangeService = inject(DbxMapboxChangeService, { optional: true });

  private static _latLngPoint = latLngPointFunction({ wrap: true });

  readonly marker = input.required<Maybe<DbxMapboxMarker>>();

  readonly latLngSignal = computed(() => {
    const marker = this.marker();
    return marker?.latLng ? DbxMapboxMarkerComponent._latLngPoint(marker.latLng) : undefined;
  });

  readonly presentationSignal = computed(() => this.marker()?.presentation ?? 'normal');

  readonly styleSignal = computed(() => {
    const marker = this.marker();

    let width = 0;
    let height = 0;

    const size = marker?.size || 'medium';

    switch (marker?.presentation) {
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

    const imageInput = marker?.image;
    const image = imageInput ? (typeof imageInput === 'string' ? imageInput : getValueFromGetter(imageInput, width)) : undefined;

    const style: any = {
      ...marker?.style,
      'background-image': image
    };

    if (width && height) {
      style.width = width + 'px';
      style.height = height + 'px';
      style['font-size'] = width + 'px';
    }

    return style;
  });

  readonly presentationCssClassSignal = computed(() => {
    const marker = this.marker();
    const presentation = this.presentationSignal();
    const markerClasses = marker?.markerClasses;

    let cssClasses: CssClassesArray = [];

    switch (presentation) {
      case 'chip':
      case 'chip-small':
        cssClasses = ['dbx-mapbox-marker-chip', 'dbx-chip', 'mat-standard-chip', 'dbx-bg'];

        if (presentation === 'chip-small') {
          cssClasses.push('dbx-chip-small');
        }

        break;
    }

    if (!marker?.icon) {
      cssClasses.push('dbx-mapbox-marker-no-icon');
    }

    if (markerClasses) {
      pushItemOrArrayItemsIntoArray(cssClasses, markerClasses);
    }

    return spaceSeparatedCssClasses(cssClasses);
  });

  ngOnDestroy(): void {
    this._dbxMapboxChangeService?.emitMarkerDestroyed();
  }
}
