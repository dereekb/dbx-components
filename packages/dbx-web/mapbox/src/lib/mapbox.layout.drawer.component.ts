import { Component, inject } from '@angular/core';
import { DbxMapboxMapStore } from './mapbox.store';

/**
 * Content drawer that connects with DbxMapboxMapStore to show the content.
 */
@Component({
  selector: 'dbx-mapbox-layout-drawer',
  templateUrl: './mapbox.layout.drawer.component.html',
  host: {
    class: 'dbx-mapbox-layout-drawer'
  }
})
export class DbxMapboxLayoutDrawerComponent {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);

  readonly config$ = this.dbxMapboxMapStore.content$;
}
