import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFlexGroupDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/flex/flex.group.directive';
import { DbxFlexSizeDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/flex/flex.size.directive';

@Component({
    templateUrl: './flex.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFlexGroupDirective, DbxFlexSizeDirective]
})
export class DocLayoutFlexComponent {}
