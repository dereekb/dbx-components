import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DemoRootSharedModule } from '@dereekb/demo-components';
import { DocFeatureLayoutComponent } from './component/feature.layout.component';
import { DocFeatureExampleComponent } from './component/feature.example.component';
import { DocFeatureCardListComponent } from './component/feature.card.list.component';
import { DocFeatureDerivedComponent } from './component/feature.derived.component';

@NgModule({
  imports: [
    CommonModule,
    DemoRootSharedModule
  ],
  declarations: [
    DocFeatureDerivedComponent,
    DocFeatureCardListComponent,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent
  ],
  exports: [
    DemoRootSharedModule,
    DocFeatureDerivedComponent,
    DocFeatureCardListComponent,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent
  ]
})
export class DocSharedModule { }
