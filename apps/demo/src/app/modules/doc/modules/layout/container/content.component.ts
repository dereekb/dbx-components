import { Component } from '@angular/core';
import { DbxContentContainerDirective, DbxContentBorderDirective, DbxContentElevateDirective, DbxContentBoxDirective, DbxContentPitDirective, DbxLabelBlockComponent, DbxContentDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { FlexModule } from '@ngbracket/ngx-layout/flex';

@Component({
  templateUrl: './content.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, DbxContentElevateDirective, DbxContentBoxDirective, DbxContentPitDirective, FlexModule, DbxLabelBlockComponent, DbxContentDirective]
})
export class DocLayoutContentComponent {}
