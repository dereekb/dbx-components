import { DbxCardBoxContainerDirective } from './card.box.container.directive';
import { DbxCardBoxComponent } from './card.box.component';
import { NgModule } from '@angular/core';

const importsAndExports = [DbxCardBoxComponent, DbxCardBoxContainerDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxCardBoxLayoutModule {}
