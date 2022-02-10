import { NgModule } from '@angular/core';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { DbxButtonComponent } from './button.component';
import { DbxButtonSpacerComponent } from './button.spacer.component';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    MatProgressButtonsModule
  ],
  declarations: [
    DbxButtonComponent,
    DbxButtonSpacerComponent
  ],
  exports: [
    MatProgressButtonsModule,
    DbxButtonComponent,
    DbxButtonSpacerComponent
  ],
})
export class DbxButtonModule {}
