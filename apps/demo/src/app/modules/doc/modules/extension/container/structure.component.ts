import { Component, inject } from '@angular/core';
import { DbxBodyDirective } from '@dereekb/dbx-web';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxStructureDirective } from '../../../../../../../../../packages/dbx-web/src/lib/extension/structure/structure.structure.directive';

@Component({
    templateUrl: './structure.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxStructureDirective]
})
export class DocExtensionStructureComponent {
  readonly dbxBody = inject(DbxBodyDirective);
}
