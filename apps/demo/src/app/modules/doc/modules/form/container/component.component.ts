import { DocFormExampleComponentFormConfig, DocFormExampleComponentFormTestViewAComponent, DocFormExampleComponentFormTestViewBComponent } from './../component/component.example.form.component';
import { Component } from '@angular/core';

@Component({
  templateUrl: './component.component.html'
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
