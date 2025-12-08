import { DbxButtonComponent, DbxContentContainerDirective, DbxContentLayoutModule, DbxWebFilePreviewComponent, DbxWebFilePreviewComponentConfig, DbxWebFilePreviewService } from '@dereekb/dbx-web';
import { Component, inject } from '@angular/core';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { ZIP_FILE_MIME_TYPE } from '@dereekb/util';

@Component({
  templateUrl: './webfilepreview.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxButtonComponent, DbxContentLayoutModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxWebFilePreviewComponent]
})
export class DocExtensionWebFilePreviewComponent {
  readonly webFilePreviewService = inject(DbxWebFilePreviewService);

  readonly zipConfig: DbxWebFilePreviewComponentConfig = {
    srcUrl: '/assets/test/test.zip',
    embedMimeType: ZIP_FILE_MIME_TYPE
  };

  readonly pngConfig: DbxWebFilePreviewComponentConfig = {
    srcUrl: '/assets/test/avatar.png',
    embedMimeType: 'image/png'
  };

  readonly imageNoMimeTypeConfig: DbxWebFilePreviewComponentConfig = {
    srcUrl: '/assets/test/avatar.png'
  };

  openZipExampleDialog() {
    this.webFilePreviewService.openPreviewDialog(this.zipConfig);
  }

  openPngExampleDialog() {
    this.webFilePreviewService.openPreviewDialog(this.pngConfig);
  }
}
