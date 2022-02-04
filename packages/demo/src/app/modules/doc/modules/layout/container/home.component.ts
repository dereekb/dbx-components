import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html'
})
export class DocLayoutHomeComponent {

  cards: DocFeatureCard[] = [{
    title: 'content',
    detail: 'dbx-content',
    anchor: {
      ref: 'doc.layout.content'
    }
  }, {
    title: 'section',
    detail: 'dbx-section',
    anchor: {
      ref: 'doc.layout.section'
    }
  }];

}
