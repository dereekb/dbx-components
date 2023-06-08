import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DbxIconButtonComponent } from './icon.button.component';

@NgModule({
  imports: [
    //
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  exports: [DbxIconButtonComponent],
  declarations: [DbxIconButtonComponent]
})
export class DbxIconButtonModule {}
