import { MatIconModule } from '@angular/material/icon';
import { DbNgxCardBoxContainerComponent } from './card.box.container.component';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxCardBoxComponent } from './card.box.component';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule
  ],
  declarations: [
    DbNgxCardBoxComponent,
    DbNgxCardBoxContainerComponent
  ],
  exports: [
    DbNgxCardBoxComponent,
    DbNgxCardBoxContainerComponent
  ]
})
export class DbNgxCardBoxLayoutModule { }
