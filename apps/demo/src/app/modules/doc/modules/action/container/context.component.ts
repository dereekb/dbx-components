import { DbxActionDirective, DbxActionDirective as DbxActionDirective_1 } from '@dereekb/dbx-core';
import { Component } from '@angular/core';
import { DbxContentContainerDirective, DbxButtonSpacerDirective, DbxContentBorderDirective, DbxLoadingComponent, DbxActionLoadingContextDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { NgIf, NgTemplateOutlet, AsyncPipe, JsonPipe } from '@angular/common';
import { DocActionExampleToolsComponent } from '../component/action.example.tool.component';

@Component({
  templateUrl: './context.component.html',
  standalone: true,
  imports: [DbxActionDirective_1, DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, MatButton, NgIf, NgTemplateOutlet, DbxButtonSpacerDirective, DbxContentBorderDirective, DbxLoadingComponent, DbxActionLoadingContextDirective, DocActionExampleToolsComponent, AsyncPipe, JsonPipe]
})
export class DocActionContextComponent {
  beginWorking(action: DbxActionDirective) {
    action.sourceInstance.startWorking();
  }

  stopWorking(action: DbxActionDirective, success: boolean) {
    if (success) {
      action.sourceInstance.resolve('success');
    } else {
      action.sourceInstance.reject({
        code: 'CLICKED_FAIL',
        message: 'we clicked fail'
      });
    }
  }
}
