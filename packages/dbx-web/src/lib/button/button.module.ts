import { MatIconModule } from '@angular/material/icon';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { DbNgxButtonComponent } from './button.component';
import { DbNgxButtonSpacerComponent } from './button.spacer.component';
import { BrowserModule } from '@angular/platform-browser';

@NgModule({
  imports: [
    BrowserModule,
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
