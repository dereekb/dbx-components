import { NgModule } from '@angular/core';
import { DbxMapboxMapDirective } from './mapbox.store.map.directive';
import { DbxMapboxLayoutComponent } from './mapbox.layout.component';
import { DbxMapboxLayoutDrawerComponent } from './mapbox.layout.drawer.component';
import { DbxMapboxMenuComponent } from './mapbox.menu.component';
import { DbxMapboxMapStoreInjectionBlockDirective } from './mapbox.store.provide';
import { DbxMapboxMarkerComponent } from './mapbox.marker.component';
import { DbxMapboxMarkersComponent } from './mapbox.markers.component';
import { DbxMapboxInjectionComponent } from './mapbox.injection.component';
import { DbxMapboxLayoutVirtualResizeSyncComponent } from './mapbox.layout.resize.sync.directive';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';

const importsAndExports = [
  //
  DbxMapboxLayoutVirtualResizeSyncComponent,
  DbxMapboxMapDirective,
  DbxMapboxLayoutComponent,
  DbxMapboxLayoutDrawerComponent,
  DbxMapboxInjectionComponent,
  DbxMapboxMenuComponent,
  DbxMapboxMarkerComponent,
  DbxMapboxMarkersComponent,
  DbxMapboxMapStoreInjectionBlockDirective,
  // modules
  NgxMapboxGLModule
];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxMapboxModule {}
