import { NgModule } from '@angular/core';
import { DbxDetachOutletComponent } from './detach.outlet.component';
import { DbxDetachInitDirective } from './detach.init.directive';
import { DbxDetachOverlayComponent } from './detach.overlay.component';
import { DbxDetachContentComponent } from './detach.content.component';
import { DbxDetachControlsComponent } from './detach.controls.component';
import { DbxDetachControlButtonsComponent } from './detach.controls.buttons.component';

const importsAndExports = [DbxDetachOutletComponent, DbxDetachInitDirective, DbxDetachOverlayComponent, DbxDetachContentComponent, DbxDetachControlsComponent, DbxDetachControlButtonsComponent];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxDetachInteractionModule {}
