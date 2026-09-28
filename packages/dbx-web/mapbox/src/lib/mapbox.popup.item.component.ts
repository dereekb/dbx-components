import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA, DbxInjectionComponent } from '@dereekb/dbx-core';
import { DbxMapboxPopupComponent } from './mapbox.popup.component';
import { type DbxMapboxItemPopupComponentData, DbxMapboxItemPopupContext } from './mapbox.popup.item';

/**
 * Popup for a single item, added to the map by dbxMapboxItemPopupController().
 *
 * Renders the controller's content component inside a DbxMapboxPopupComponent anchored to the item, and provides DbxMapboxItemPopupContext to that content.
 */
@Component({
  selector: 'dbx-mapbox-item-popup',
  template: `
    <dbx-mapbox-popup [latLng]="latLngSignal()" [config]="popupConfig" (popupClose)="close()">
      <dbx-injection [config]="content"></dbx-injection>
    </dbx-mapbox-popup>
  `,
  providers: [
    {
      provide: DbxMapboxItemPopupContext,
      useExisting: DbxMapboxItemPopupComponent
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxMapboxPopupComponent, DbxInjectionComponent]
})
export class DbxMapboxItemPopupComponent<T = unknown> extends DbxMapboxItemPopupContext<T> {
  private readonly _data = inject<DbxMapboxItemPopupComponentData<T>>(DBX_INJECTION_COMPONENT_DATA);

  readonly popupComponent = viewChild.required(DbxMapboxPopupComponent);

  readonly item = this._data.item;
  readonly content = this._data.content;
  readonly popupConfig = this._data.popup;

  readonly latLngSignal = computed(() => this._data.latLng(this.item()));

  close(): void {
    this._data.close();
  }

  panIntoView(): void {
    this.popupComponent().panIntoView();
  }
}
