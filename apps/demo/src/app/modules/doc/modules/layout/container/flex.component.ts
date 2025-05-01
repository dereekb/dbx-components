import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFlexGroupDirective } from '@dereekb/dbx-web';
import { DbxFlexSizeDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './flex.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFlexGroupDirective, DbxFlexSizeDirective]
})
export class DocLayoutFlexComponent {}
