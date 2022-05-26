import { MatIconModule } from '@angular/material/icon';
import { DbxCardBoxContainerComponent } from './card.box.container.component';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxCardBoxComponent } from './card.box.component';

@NgModule({
  imports: [CommonModule, MatIconModule],
  declarations: [DbxCardBoxComponent, DbxCardBoxContainerComponent],
  exports: [DbxCardBoxComponent, DbxCardBoxContainerComponent]
})
export class DbxCardBoxLayoutModule {}
