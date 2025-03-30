import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DbxIconButtonComponent } from './icon.button.component';

/**
 * @deprecated import DbxIconButtonComponent directly instead.
 */
@NgModule({
  imports: [DbxIconButtonComponent],
  exports: [DbxIconButtonComponent]
})
export class DbxIconButtonModule {}
