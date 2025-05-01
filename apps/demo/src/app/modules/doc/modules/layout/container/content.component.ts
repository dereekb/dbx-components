import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxContentBorderDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { DbxContentElevateDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.elevate.directive';
import { DbxContentBoxDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.box.directive';
import { DbxContentPitDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.pit.directive';
import { FlexModule } from '@ngbracket/ngx-layout/flex';
import { DbxLabelBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/label.block.component';
import { DbxContentDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.directive';

@Component({
    templateUrl: './content.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, DbxContentElevateDirective, DbxContentBoxDirective, DbxContentPitDirective, FlexModule, DbxLabelBlockComponent, DbxContentDirective]
})
export class DocLayoutContentComponent {}
