import { MatIconModule } from '@angular/material/icon';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { DbxButtonComponent } from './button.component';
import { DbxButtonSpacerComponent } from './button.spacer.component';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressButtonsModule
  ],
  declarations: [
    DbxButtonComponent,
    DbxButtonSpacerComponent
  ],
  exports: [
    DbxButtonComponent,
    DbxButtonSpacerComponent
  ],
})
export class DbxButtonModule {}
