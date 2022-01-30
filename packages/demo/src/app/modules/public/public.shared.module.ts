import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppSharedModule } from '../shared/app.shared.module';

@NgModule({
  exports: [
    CommonModule,
    // Modules
    AppSharedModule,
  ]
})
export class PublicSharedModule { }
