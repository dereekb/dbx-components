import { Component, inject } from '@angular/core';
import { DbxMapboxMapStore } from './mapbox.store';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxInjectionComponent } from '@dereekb/dbx-core';

/**
 * Content drawer that connects with DbxMapboxMapStore to show the content.
 */
@Component({
  selector: 'dbx-mapbox-layout-drawer',
  templateUrl: './mapbox.layout.drawer.component.html',
  host: {
    class: 'dbx-mapbox-layout-drawer'
  },
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxMapboxLayoutDrawerComponent {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);
  readonly drawerConfigSignal = toSignal(this.dbxMapboxMapStore.drawerContent$);
}
