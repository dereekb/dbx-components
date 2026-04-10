import { type DocFormExampleComponentFormConfig, DocFormExampleComponentFormTestViewAComponent, DocFormExampleComponentFormTestViewBComponent, DocFormExampleComponentFormComponent } from './../component/component.example.form.component';
import { DocForgeExampleComponentFormComponent } from './../component/component.example.forge.form.component';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { DbxContentContainerDirective, DbxBarDirective, DbxButtonSpacerDirective, DbxSpacerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { MatButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { DbxFormFormlyComponentFieldModule } from '@dereekb/dbx-form';

@Component({
  templateUrl: './component.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DbxBarDirective, MatSlideToggle, MatButton, DbxButtonSpacerDirective, DbxSpacerDirective, DocFormExampleComponentFormComponent, DocForgeExampleComponentFormComponent, DbxFormFormlyComponentFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormComponentComponent {
  readonly disabled = signal(false);

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
