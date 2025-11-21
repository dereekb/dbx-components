import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxIframeComponent, DbxBasicLoadingComponent, DbxContentLayoutModule, DbxLabelBlockComponent, DbxLoadingModule, DbxLoadingProgressComponent, DbxEmbedComponent } from '@dereekb/dbx-web';

import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './iframe.component.html',
  imports: [DbxLoadingModule, DbxContentLayoutModule, DbxLabelBlockComponent, DbxLoadingProgressComponent, DbxBasicLoadingComponent, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxIframeComponent, DbxEmbedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocInteractionIframeComponent {
  readonly contentUrl = 'https://iframetester.com/';

  /**
   * Not necessarily required, but recommended.
   */
  readonly embedMimeType = 'application/pdf';
  readonly embedSrcUrl = 'https://staging.hellosubs.co/assets/test/resume/resume.pdf';
}
