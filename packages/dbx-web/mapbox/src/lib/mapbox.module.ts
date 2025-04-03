import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxMapboxMapDirective } from './mapbox.store.map.directive';
import { DbxMapboxConfig } from './mapbox.service';
import { DbxMapboxLayoutComponent } from './mapbox.layout.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { DbxMapboxLayoutDrawerComponent } from './mapbox.layout.drawer.component';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AngularResizeEventModule } from 'angular-resize-event-package';
import { DbxMapboxMenuComponent } from './mapbox.menu.component';
import { DbxMapboxMapStoreInjectionBlockDirective } from './mapbox.store.provide';
import { DbxMapboxMarkerComponent } from './mapbox.marker.component';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import { DbxRouterAnchorModule, DbxStyleLayoutModule } from '@dereekb/dbx-web';
import { DbxMapboxMarkersComponent } from './mapbox.markers.component';
import { DbxMapboxInjectionComponent } from './mapbox.injection.component';
import { DbxMapboxLayoutVirtualResizeSyncComponent } from './mapbox.layout.resize.sync.directive';

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
  DbxMapboxMapStoreInjectionBlockDirective
];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxMapboxModule {}
