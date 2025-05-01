import { Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxSectionComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/section/section.component';
import { MatButton } from '@angular/material/button';
import { DbxSubSectionComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/section/subsection.component';

@Component({
    templateUrl: './section.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxSectionComponent, MatButton, DbxSubSectionComponent]
})
export class DocLayoutSectionComponent {
  lorem = LOREM;
}
