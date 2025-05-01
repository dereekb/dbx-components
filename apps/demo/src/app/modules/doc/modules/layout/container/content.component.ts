import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DbxContentElevateDirective } from '@dereekb/dbx-web';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DbxContentPitDirective } from '@dereekb/dbx-web';
import { FlexModule } from '@ngbracket/ngx-layout/flex';
import { DbxLabelBlockComponent } from '@dereekb/dbx-web';
import { DbxContentDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './content.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, DbxContentElevateDirective, DbxContentBoxDirective, DbxContentPitDirective, FlexModule, DbxLabelBlockComponent, DbxContentDirective]
})
export class DocLayoutContentComponent {}
