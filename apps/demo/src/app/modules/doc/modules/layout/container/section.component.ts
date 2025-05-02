import { Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxContentContainerDirective, DbxSectionComponent, DbxSubSectionComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';

@Component({
  templateUrl: './section.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxSectionComponent, MatButton, DbxSubSectionComponent]
})
export class DocLayoutSectionComponent {
  lorem = LOREM;
}
