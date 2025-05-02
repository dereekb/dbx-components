import { DocFormExampleComponentFormConfig, DocFormExampleComponentFormTestViewAComponent, DocFormExampleComponentFormTestViewBComponent, DocFormExampleComponentFormComponent } from './../component/component.example.form.component';
import { Component } from '@angular/core';
import { DbxContentContainerDirective, DbxBarDirective, DbxButtonSpacerDirective, DbxSpacerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { DbxFormFormlyComponentFieldModule } from '@dereekb/dbx-form';

@Component({
  templateUrl: './component.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxBarDirective, MatButton, DbxButtonSpacerDirective, DbxSpacerDirective, DocFormExampleComponentFormComponent, DbxFormFormlyComponentFieldModule]
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
