import { MatIconModule } from '@angular/material/icon';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { DbNgxButtonComponent } from './button.component';
import { DbNgxButtonSpacerComponent } from './button.spacer.component';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressButtonsModule
  ],
  declarations: [
    DbNgxButtonComponent,
    DbNgxButtonSpacerComponent
  ],
  exports: [
    DbNgxButtonComponent,
    DbNgxButtonSpacerComponent
  ],
})
export class DbNgxButtonModule {}
