import { DbxActionDirective } from '@dereekb/dbx-core';
import { Component } from '@angular/core';

@Component({
  templateUrl: './context.component.html'
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
