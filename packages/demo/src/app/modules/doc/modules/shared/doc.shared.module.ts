import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DocFeatureLayoutComponent } from './component/feature.layout.component';
import { DocFeatureExampleComponent } from './component/feature.example.component';

@NgModule({
  imports: [
    CommonModule,
    AppSharedModule
  ],
  declarations: [
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent
  ],
  exports: [
    AppSharedModule,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent
  ]
})
export class DocSharedModule { }
