import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DbxBodyDirective, DbxContentContainerDirective, DbxStructureDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './structure.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxStructureDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionStructureComponent {
  readonly dbxBody = inject(DbxBodyDirective);
}
