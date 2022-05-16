import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DemoSharedModule } from '@/shared/shared.module';
import { DocFeatureLayoutComponent } from './component/feature.layout.component';
import { DocFeatureExampleComponent } from './component/feature.example.component';
import { DocFeatureCardListComponent } from './component/feature.card.list.component';
import { DocFeatureDerivedComponent } from './component/feature.derived.component';

@NgModule({
  imports: [
    CommonModule,
    DemoSharedModule
  ],
  declarations: [
    DocFeatureDerivedComponent,
    DocFeatureCardListComponent,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent
  ],
  exports: [
    DemoSharedModule,
    DocFeatureDerivedComponent,
    DocFeatureCardListComponent,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent
  ]
})
export class DocSharedModule { }
