import { Component, ChangeDetectionStrategy } from '@angular/core';
import { DbxContentContainerDirective, DbxContentBorderDirective, DbxFileUploadAreaComponent, DbxFileUploadButtonComponent, type DbxFileUploadAreaFilesChangedEvent, DbxContentPitDirective, DbxFileUploadComponent, type DbxFileUploadButtonFilesChangedEvent, type DbxFileUploadFilesChangedEvent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { JsonPipe, NgTemplateOutlet } from '@angular/common';
import { type Maybe } from '@dereekb/util';

function mapFileToString(file: File) {
  return `${file.name} (${file.size} bytes) - ${file.type}`;
}

@Component({
  templateUrl: './upload.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, DbxContentPitDirective, NgTemplateOutlet, DbxFileUploadComponent, DbxFileUploadAreaComponent, DbxFileUploadButtonComponent, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionUploadComponent {
  filesUploaded: Maybe<DbxFileUploadFilesChangedEvent>;
  buttonModeFilesUploaded: Maybe<DbxFileUploadFilesChangedEvent>;
  imagesUploaded: Maybe<DbxFileUploadAreaFilesChangedEvent>;
  areaCustomUploaded: Maybe<DbxFileUploadAreaFilesChangedEvent>;
  areaImagesUploaded: Maybe<DbxFileUploadAreaFilesChangedEvent>;

  filesChangeResult(filesChangedEvent: Maybe<DbxFileUploadAreaFilesChangedEvent | DbxFileUploadButtonFilesChangedEvent>) {
    const result = filesChangedEvent
      ? {
          allFiles: filesChangedEvent.allFiles.length,
          matchResult: {
            accepted: filesChangedEvent.matchResult.accepted.map(mapFileToString),
            rejected: filesChangedEvent.matchResult.rejected.map(mapFileToString)
          }
        }
      : undefined;
    return result;
  }
}
