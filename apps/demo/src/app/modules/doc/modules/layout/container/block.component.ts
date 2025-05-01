import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxTwoBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/block/two.block.component';

@Component({
    templateUrl: './block.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxTwoBlockComponent]
})
export class DocLayoutTwoBlockComponent {}
