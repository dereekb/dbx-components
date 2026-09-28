import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardImage, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { DbxBarDirective, DbxChipDirective, DbxDialogContentCloseComponent } from '@dereekb/dbx-web';
import { DbxMapboxChangeService, DbxMapboxInjectionComponent, DbxMapboxInjectionStore, DbxMapboxItemPopupContext, DbxMapboxMapDirective, DbxMapboxMapStore, type DbxMapboxMarkerFactory, DbxMapboxMarkersComponent, dbxMapboxItemPopupController, type KnownMapboxStyle, mapboxStaticImageUrl } from '@dereekb/dbx-web/mapbox';
import { type LatLngPoint, type Maybe } from '@dereekb/util';
import { type LngLatLike } from 'mapbox-gl';
import { MAPBOX_API_KEY, MapComponent } from 'ngx-mapbox-gl';

export interface DocExtensionMapboxPopupExampleItem {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly tag: string;
  readonly description: string;
  readonly hours: string;
  readonly latLng: LatLngPoint;
  /**
   * Style of the hero image. The popup has no hero image when unset.
   */
  readonly heroStyle?: Maybe<KnownMapboxStyle>;
}

export const DOC_EXTENSION_MAPBOX_POPUP_EXAMPLE_ITEMS: DocExtensionMapboxPopupExampleItem[] = [
  {
    id: 'capitol',
    name: 'Texas State Capitol',
    icon: 'account_balance',
    tag: 'Open today',
    description: 'Free guided tours leave from the south foyer every 30 minutes.',
    hours: '9:00a – 5:00p',
    latLng: { lat: 30.2747, lng: -97.7404 },
    heroStyle: 'mapbox://styles/mapbox/satellite-streets-v12'
  },
  {
    id: 'zilker',
    name: 'Zilker Park',
    icon: 'park',
    tag: 'Free',
    description: 'Barton Springs Pool sits at the south end of the park. This item has no hero image.',
    hours: '5:00a – 10:00p',
    latLng: { lat: 30.2669, lng: -97.7729 }
  }
];

/**
 * Content of the example item popup. Built from a mat-card, a dbx-chip, and a dbx-dialog-content-close.
 */
@Component({
  template: `
    <mat-card>
      @if (heroImageSignal()) {
        <img mat-card-image [src]="heroImageSignal()" [alt]="item().name" width="340" height="150" />
      }
      <dbx-dialog-content-close [padded]="false" (close)="close()"></dbx-dialog-content-close>
      <mat-card-header>
        <mat-card-title>{{ item().name }}</mat-card-title>
        <mat-card-subtitle>{{ item().hours }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <dbx-chip [small]="true" color="primary">{{ item().tag }}</dbx-chip>
        <p>{{ item().description }}</p>
      </mat-card-content>
      <mat-card-actions>
        <button mat-flat-button class="dbx-w100" (click)="close()">Got it</button>
      </mat-card-actions>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCard, MatCardImage, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatCardActions, MatButton, DbxChipDirective, DbxDialogContentCloseComponent]
})
export class DocExtensionMapboxPopupExampleContentComponent {
  readonly context = inject(DbxMapboxItemPopupContext) as DbxMapboxItemPopupContext<DocExtensionMapboxPopupExampleItem>;
  readonly accessToken = inject(MAPBOX_API_KEY, { optional: true }) as Maybe<string>;

  readonly item = this.context.item;

  readonly heroImageSignal = computed(() => {
    const { latLng, heroStyle } = this.item();
    return heroStyle && this.accessToken ? mapboxStaticImageUrl({ latLng, zoom: 16, width: 340, height: 150, style: heroStyle, accessToken: this.accessToken }) : undefined;
  });

  close() {
    this.context.close();
  }
}

/**
 * Map with two markers. Clicking a marker opens its item in a popup.
 *
 * Provides its own map and injection stores so the popup only ever renders on this map.
 */
@Component({
  selector: 'doc-extension-mapbox-popup-example',
  template: `
    <div class="doc-extension-mapbox-popup-example-map">
      <mgl-map dbxMapboxMap [center]="center" [zoom]="zoom">
        <dbx-mapbox-markers [data]="items" [markerFactory]="markerFactory"></dbx-mapbox-markers>
        <dbx-mapbox-injection></dbx-mapbox-injection>
      </mgl-map>
    </div>
    <dbx-bar>
      @for (item of items; track item.id) {
        <button mat-button (click)="popup.open(item)">Open {{ item.name }}</button>
      }
      <button mat-button [disabled]="!popup.isOpen()" (click)="popup.close()">Close</button>
      <span class="dbx-hint">Open: {{ popup.item()?.name ?? 'none' }}</span>
    </dbx-bar>
  `,
  styles: `
    .doc-extension-mapbox-popup-example-map {
      height: 480px;
      overflow: hidden;
      border-radius: var(--mat-sys-corner-large);
    }
  `,
  providers: [DbxMapboxMapStore, DbxMapboxInjectionStore, DbxMapboxChangeService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapComponent, DbxMapboxMapDirective, DbxMapboxMarkersComponent, DbxMapboxInjectionComponent, DbxBarDirective, MatButton]
})
export class DocExtensionMapboxPopupExampleComponent {
  readonly items = DOC_EXTENSION_MAPBOX_POPUP_EXAMPLE_ITEMS;
  readonly center: LngLatLike = [-97.7566, 30.2712];
  readonly zoom: [number] = [13];

  readonly popup = dbxMapboxItemPopupController<DocExtensionMapboxPopupExampleItem>({
    latLng: (item) => item.latLng,
    content: { componentClass: DocExtensionMapboxPopupExampleContentComponent }
  });

  readonly markerFactory: DbxMapboxMarkerFactory<DocExtensionMapboxPopupExampleItem> = (item) => ({
    id: item.id,
    presentation: 'chip',
    icon: item.icon,
    label: item.name,
    latLng: item.latLng,
    anchor: {
      onClick: () => this.popup.open(item)
    }
  });
}
