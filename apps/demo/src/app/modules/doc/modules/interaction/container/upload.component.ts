import { Component } from '@angular/core';
import { DbxContentContainerDirective, DbxContentBorderDirective, DbxFileUploadAreaComponent, DbxFileUploadButtonComponent, DbxFileUploadAreaFilesChangedEvent, DbxContentPitDirective, DbxFileUploadComponent, DbxFileUploadButtonFilesChangedEvent, DbxFileUploadFilesChangedEvent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import { Maybe } from '@dereekb/util';

function mapFileToString(file: File) {
  return `${file.name} (${file.size} bytes) - ${file.type}`;
}

@Component({
  templateUrl: './upload.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, DbxContentPitDirective, NgTemplateOutlet, DbxFileUploadComponent, DbxFileUploadAreaComponent, DbxFileUploadButtonComponent, JsonPipe]
})
export class DocInteractionUploadComponent {
  filesUploaded: Maybe<DbxFileUploadFilesChangedEvent>;
  imagesUploaded: Maybe<DbxFileUploadAreaFilesChangedEvent>;
  areaImagesUploaded: Maybe<DbxFileUploadAreaFilesChangedEvent>;

  filesChangeResult(filesChangedEvent: Maybe<DbxFileUploadAreaFilesChangedEvent | DbxFileUploadButtonFilesChangedEvent>) {
    if (filesChangedEvent) {
      return {
        allFiles: filesChangedEvent.allFiles.length,
        matchResult: {
          accepted: filesChangedEvent.matchResult.accepted.map(mapFileToString),
          rejected: filesChangedEvent.matchResult.rejected.map(mapFileToString)
        }
      };
    } else {
      return undefined;
    }
  }
}
