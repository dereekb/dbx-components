import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxStepComponent } from './step.component';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule
  ],
  declarations: [
    DbNgxStepComponent
  ],
  exports: [
    DbNgxStepComponent
  ],
})
export class DbNgxStepLayoutModule { }
