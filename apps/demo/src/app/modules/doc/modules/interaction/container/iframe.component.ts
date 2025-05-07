import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxIframeComponent, DbxBasicLoadingComponent, DbxContentLayoutModule, DbxLabelBlockComponent, DbxLoadingModule, DbxLoadingProgressComponent } from '@dereekb/dbx-web';

import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './iframe.component.html',
  imports: [DbxLoadingModule, DbxContentLayoutModule, DbxLabelBlockComponent, DbxLoadingProgressComponent, DbxBasicLoadingComponent, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxIframeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocInteractionIframeComponent {
  readonly contentUrl = 'https://iframetester.com/';
}
