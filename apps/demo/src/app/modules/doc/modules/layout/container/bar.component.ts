import { Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxPagebarComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/bar/pagebar.component';
import { MatButton } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';
import { DbxContentBorderDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { DbxBarDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/bar/bar.directive';
import { DbxSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/style/spacer.directive';
import { DbxBarHeaderComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/bar/bar.header.component';

@Component({
    templateUrl: './bar.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxPagebarComponent, MatButton, DbxButtonSpacerDirective, DbxContentBorderDirective, DbxBarDirective, DbxSpacerDirective, DbxBarHeaderComponent]
})
export class DocLayoutBarComponent {
  lorem = LOREM;
}
