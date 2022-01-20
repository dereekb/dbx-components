import { DbNgxAnchorModule } from '../../router';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxSectionComponent } from './section.component';
import { DbNgxSubSectionComponent } from './subsection.component';
import { DbNgxSectionBoxComponent } from './section.box.component';
import { DbNgxSectionPageComponent } from './section.page.component';
import { DbNgxSectionElevatedComponent } from './section.elevated.component';
import { DbNgxSectionBoxAnchorComponent } from './section.box.anchor.component';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { DbNgxTwoBlocksComponent } from '../block/two.block.component';
import { DbNgxIntroActionSectionComponent } from './section.intro.component';

/**
 * Module for container-type components.
 */
@NgModule({
  imports: [
    CommonModule,
    DbNgxAnchorModule,
    MatButtonModule,
    MatRippleModule,
    MatIconModule
  ],
  declarations: [
    DbNgxSectionPageComponent,
    DbNgxSectionBoxComponent,
    DbNgxSectionBoxAnchorComponent,
    DbNgxSectionElevatedComponent,
    DbNgxSectionComponent,
    DbNgxSubSectionComponent,
    DbNgxIntroActionSectionComponent,
    DbNgxTwoBlocksComponent
  ],
  exports: [
    DbNgxSectionPageComponent,
    DbNgxSectionBoxComponent,
    DbNgxSectionBoxAnchorComponent,
    DbNgxSectionElevatedComponent,
    DbNgxSectionComponent,
    DbNgxSubSectionComponent,
    DbNgxIntroActionSectionComponent,
    DbNgxTwoBlocksComponent
  ]
})
export class DbNgxSectionLayoutModule { }
