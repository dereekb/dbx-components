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
import { AngularResizeEventModule } from 'angular-resize-event';
import { DbxMapboxMenuComponent } from './mapbox.menu.component';
import { DbxMapboxMapStoreInjectionBlockDirective } from './mapbox.store.provide';
import { DbxMapboxMarkerComponent } from './mapbox.marker.component';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import { DbxRouterAnchorModule } from '@dereekb/dbx-web';
import { DbxMapboxMarkersComponent } from './mapbox.markers.component';
import { DbxMapboxInjectionComponent } from './mapbox.injection.component';

const declarations = [
  //
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
  imports: [
    //
    CommonModule,
    MatSidenavModule,
    DbxInjectionComponentModule,
    MatButtonModule,
    MatIconModule,
    AngularResizeEventModule,
    DbxRouterAnchorModule,
    NgxMapboxGLModule
  ],
  declarations,
  exports: declarations
})
export class DbxMapboxModule {
  static forRoot(config: DbxMapboxConfig): ModuleWithProviders<DbxMapboxModule> {
    return {
      ngModule: DbxMapboxModule,
      providers: [
        {
          provide: DbxMapboxConfig,
          useValue: config
        }
      ]
    };
  }
}
