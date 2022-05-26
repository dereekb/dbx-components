import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxBarDirective } from './bar.directive';
import { DbxBarHeaderComponent } from './bar.header.component';
import { DbxPagebarComponent } from './pagebar.component';

/**
 * Module for block components.
 */
@NgModule({
  imports: [CommonModule, MatToolbarModule, MatIconModule],
  declarations: [DbxBarDirective, DbxBarHeaderComponent, DbxPagebarComponent],
  exports: [DbxBarDirective, DbxBarHeaderComponent, DbxPagebarComponent]
})
export class DbxBarLayoutModule {}
