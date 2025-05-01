import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxTwoBlockComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './block.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxTwoBlockComponent]
})
export class DocLayoutTwoBlockComponent {}
