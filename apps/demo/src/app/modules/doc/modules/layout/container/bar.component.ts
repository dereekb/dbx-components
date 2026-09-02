import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxContentContainerDirective, DbxPagebarComponent, DbxButtonSpacerDirective, DbxContentBorderDirective, DbxBarDirective, DbxSpacerDirective, DbxBarHeaderComponent, DbxColorDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';

@Component({
  templateUrl: './bar.component.html',
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxPagebarComponent, MatButton, DbxButtonSpacerDirective, DbxContentBorderDirective, DbxBarDirective, DbxSpacerDirective, DbxBarHeaderComponent, DbxColorDirective]
})
export class DocLayoutBarComponent {
  lorem = LOREM;
}
