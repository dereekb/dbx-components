import { Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxSectionComponent } from '@dereekb/dbx-web';
import { MatButton } from '@angular/material/button';
import { DbxSubSectionComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './section.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxSectionComponent, MatButton, DbxSubSectionComponent]
})
export class DocLayoutSectionComponent {
  lorem = LOREM;
}
