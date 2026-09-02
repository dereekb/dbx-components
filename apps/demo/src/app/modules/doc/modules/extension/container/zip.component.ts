import { DbxContentContainerDirective, DbxContentLayoutModule, DbxZipPreviewComponent } from '@dereekb/dbx-web';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './zip.component.html',
  imports: [DbxContentContainerDirective, DbxContentLayoutModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxZipPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionZipComponent {
  readonly zipUrl = '/assets/test/test.zip';
}
