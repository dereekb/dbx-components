import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DocFeatureLayoutComponent } from './component/feature.layout.component';
import { DocFeatureExampleComponent } from './component/feature.example.component';
import { DocFeatureCardListComponent } from './component/feature.card.list.component';

@NgModule({
  imports: [
    CommonModule,
    AppSharedModule
  ],
  declarations: [
    DocFeatureCardListComponent,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent
  ],
  exports: [
    AppSharedModule,
    DocFeatureCardListComponent,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent
  ]
})
export class DocSharedModule { }
