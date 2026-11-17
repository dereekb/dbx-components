import { Component } from '@angular/core';
import { DbxContentContainerDirective, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxHeightSyncDirective, DbxHeightSyncFollowerDirective, DbxHeightSyncSourceDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './flex.component.html',
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxHeightSyncDirective, DbxHeightSyncSourceDirective, DbxHeightSyncFollowerDirective]
})
export class DocLayoutFlexComponent {}
