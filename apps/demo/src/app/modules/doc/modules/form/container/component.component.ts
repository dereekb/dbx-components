import { DocFormExampleComponentFormConfig, DocFormExampleComponentFormTestViewAComponent, DocFormExampleComponentFormTestViewBComponent } from './../component/component.example.form.component';
import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxBarDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/bar/bar.directive';
import { MatButton } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';
import { DbxSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/style/spacer.directive';
import { DocFormExampleComponentFormComponent } from '../component/component.example.form.component';

@Component({
    templateUrl: './component.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxBarDirective, MatButton, DbxButtonSpacerDirective, DbxSpacerDirective, DocFormExampleComponentFormComponent]
})
export class DocFormComponentComponent {
  config: DocFormExampleComponentFormConfig = {
    componentClass: DocFormExampleComponentFormTestViewAComponent
  };

  showA() {
    this.config = {
      componentClass: DocFormExampleComponentFormTestViewAComponent
    };
  }

  showB() {
    this.config = {
      componentClass: DocFormExampleComponentFormTestViewBComponent
    };
  }
}
