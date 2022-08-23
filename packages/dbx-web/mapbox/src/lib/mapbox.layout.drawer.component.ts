import { DbxMapboxMapDirective } from './mapbox.store.map.directive';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { DbxMapboxMapStore } from './mapbox.store';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';

/**
 * Content drawer that connects with DbxMapboxMapStore to
 */
@Component({
  selector: 'dbx-mapbox-layout-drawer',
  templateUrl: './mapbox.layout.drawer.component.html',
  host: {
    class: 'dbx-mapbox-layout-drawer'
  }
})
export class DbxMapboxLayoutDrawerComponent {
  readonly config$ = this.dbxMapboxMapStore.content$;

  constructor(readonly dbxMapboxMapStore: DbxMapboxMapStore) {}
}
