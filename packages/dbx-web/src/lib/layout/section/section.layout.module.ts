import { DbxRouterAnchorModule } from '../../router';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { DbxSectionComponent } from './section.component';
import { DbxSubSectionComponent } from './subsection.component';
import { DbxSectionPageComponent } from './section.page.component';
import { DbxIntroActionSectionComponent } from './section.intro.component';
import { DbxSectionHeaderComponent } from './section.header.component';

const importsAndExports = [DbxSectionHeaderComponent, DbxSectionPageComponent, DbxSectionComponent, DbxSubSectionComponent, DbxIntroActionSectionComponent];

/**
 * Module for dbx-section components.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxSectionLayoutModule {}
