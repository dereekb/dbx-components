import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxBarComponent } from './bar.component';
import { DbxBarHeaderComponent } from './bar.header.component';
import { DbxPagebarComponent } from './pagebar.component';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule
  ],
  declarations: [
    DbxBarComponent,
    DbxBarHeaderComponent,
    DbxPagebarComponent
  ],
  exports: [
    DbxBarComponent,
    DbxBarHeaderComponent,
    DbxPagebarComponent
  ]
})
export class DbxBarLayoutModule { }
