import { CommonModule } from '@angular/common';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
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
