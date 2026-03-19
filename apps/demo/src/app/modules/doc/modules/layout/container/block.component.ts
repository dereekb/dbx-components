import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective, DbxTwoBlockComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './block.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxTwoBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocLayoutTwoBlockComponent {}
