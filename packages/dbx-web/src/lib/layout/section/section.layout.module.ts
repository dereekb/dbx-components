import { NgModule } from '@angular/core';
import { DbxSectionComponent } from './section.component';
import { DbxSubSectionComponent } from './subsection.component';
import { DbxSectionPageComponent } from './section.page.component';
import { DbxIntroActionSectionComponent } from './section.intro.component';
import { DbxSectionHeaderComponent } from './section.header.component';

const importsAndExports = [DbxSectionHeaderComponent, DbxSectionPageComponent, DbxSectionComponent, DbxSubSectionComponent, DbxIntroActionSectionComponent];

/**
 * Bundles all section layout components including section headers, sections, subsections,
 * section pages, and the intro action section for convenient import.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxSectionLayoutModule {}
