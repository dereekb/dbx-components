import { DbxAnchorModule } from '../../router';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxSectionComponent } from './section.component';
import { DbxSubSectionComponent } from './subsection.component';
import { DbxSectionBoxComponent } from './section.box.component';
import { DbxSectionPageComponent } from './section.page.component';
import { DbxSectionElevatedComponent } from './section.elevated.component';
import { DbxSectionBoxAnchorComponent } from './section.box.anchor.component';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { DbxIntroActionSectionComponent } from './section.intro.component';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * Module for container-type components.
 */
@NgModule({
  imports: [
    CommonModule,
    DbxAnchorModule,
    MatButtonModule,
    MatRippleModule,
    MatIconModule
  ],
  declarations: [
    DbxSectionHeaderComponent,
    DbxSectionPageComponent,
    DbxSectionBoxComponent,
    DbxSectionBoxAnchorComponent,
    DbxSectionElevatedComponent,
    DbxSectionComponent,
    DbxSubSectionComponent,
    DbxIntroActionSectionComponent
  ],
  exports: [
    DbxSectionHeaderComponent,
    DbxSectionPageComponent,
    DbxSectionBoxComponent,
    DbxSectionBoxAnchorComponent,
    DbxSectionElevatedComponent,
    DbxSectionComponent,
    DbxSubSectionComponent,
    DbxIntroActionSectionComponent
  ]
})
export class DbxSectionLayoutModule { }
