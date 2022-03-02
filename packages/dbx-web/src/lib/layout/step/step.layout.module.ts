import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxStepComponent } from './step.component';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule
  ],
  declarations: [
    DbxStepComponent
  ],
  exports: [
    DbxStepComponent
  ],
})
export class DbxStepLayoutModule { }
