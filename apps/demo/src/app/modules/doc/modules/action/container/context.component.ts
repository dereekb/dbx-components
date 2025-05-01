import { DbxActionDirective } from '@dereekb/dbx-core';
import { Component } from '@angular/core';
import { DbxActionDirective as DbxActionDirective_1 } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/context/action.directive';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { NgIf, NgTemplateOutlet, AsyncPipe, JsonPipe } from '@angular/common';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';
import { DbxContentBorderDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { DbxLoadingComponent } from '../../../../../../../../../packages/dbx-web/src/lib/loading/loading.component';
import { DbxActionLoadingContextDirective } from '../../../../../../../../../packages/dbx-web/src/lib/loading/loading.action.directive';
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
