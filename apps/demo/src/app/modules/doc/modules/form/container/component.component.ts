import { DocFormExampleComponentFormConfig, DocFormExampleComponentFormTestViewAComponent, DocFormExampleComponentFormTestViewBComponent } from './../component/component.example.form.component';
import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxBarDirective } from '@dereekb/dbx-web';
import { MatButton } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { DbxSpacerDirective } from '@dereekb/dbx-web';
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
