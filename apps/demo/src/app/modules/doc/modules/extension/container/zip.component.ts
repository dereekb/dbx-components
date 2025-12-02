import { DbxContentContainerDirective, DbxContentLayoutModule, DbxZipPreviewComponent } from '@dereekb/dbx-web';
import { Component } from '@angular/core';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './zip.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxContentLayoutModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxZipPreviewComponent]
})
export class DocExtensionZipComponent {
  readonly zipUrl = '/assets/test/test.zip';
}
