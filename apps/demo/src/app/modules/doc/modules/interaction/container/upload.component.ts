import { Component } from '@angular/core';
import { DbxContentContainerDirective, DbxContentBorderDirective, DbxFileUploadAreaComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { JsonPipe } from '@angular/common';

@Component({
  templateUrl: './upload.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, DbxFileUploadAreaComponent, JsonPipe]
})
export class DocInteractionUploadComponent {}
