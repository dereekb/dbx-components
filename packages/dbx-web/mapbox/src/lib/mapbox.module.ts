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

const declarations = [
  //
  DbxMapboxMapDirective,
  DbxMapboxLayoutComponent,
  DbxMapboxLayoutDrawerComponent,
  DbxMapboxMenuComponent
];

@NgModule({
  imports: [
    //
    CommonModule,
    MatSidenavModule,
    DbxInjectionComponentModule,
    MatButtonModule,
    MatIconModule,
    AngularResizeEventModule
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
