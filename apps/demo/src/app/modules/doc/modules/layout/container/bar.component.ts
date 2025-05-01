import { Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxPagebarComponent } from '@dereekb/dbx-web';
import { MatButton } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DbxBarDirective } from '@dereekb/dbx-web';
import { DbxSpacerDirective } from '@dereekb/dbx-web';
import { DbxBarHeaderComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './bar.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxPagebarComponent, MatButton, DbxButtonSpacerDirective, DbxContentBorderDirective, DbxBarDirective, DbxSpacerDirective, DbxBarHeaderComponent]
})
export class DocLayoutBarComponent {
  lorem = LOREM;
}
