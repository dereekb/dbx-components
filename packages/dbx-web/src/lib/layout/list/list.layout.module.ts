import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxListEmptyContentComponent } from './list.empty.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxListEmptyContentComponent
  ],
  exports: [
    DbxListEmptyContentComponent
  ]
})
export class DbxListLayoutModule { }
