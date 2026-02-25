import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxIframeComponent, DbxContentLayoutModule, DbxLoadingModule, DbxEmbedComponent } from '@dereekb/dbx-web';

import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './iframe.component.html',
  imports: [DbxLoadingModule, DbxContentLayoutModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxIframeComponent, DbxEmbedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocInteractionIframeComponent {
  readonly contentUrl = 'https://iframetester.com/';

  /**
   * Type is necessarily required, but recommended.
   */
  readonly embedPdfMimeType = 'application/pdf';
  readonly embedPdfSrcUrl = '/assets/test/resume.pdf';

  readonly embedImageMimeType = 'image/png';
  readonly embedImageSrcUrl = '/assets/test/avatar.png';
}
