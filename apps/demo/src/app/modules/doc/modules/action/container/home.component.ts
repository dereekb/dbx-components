import { DOC_ACTION_ROUTES } from '../doc.action';
import { DocFeatureCard, DocFeatureCardListComponent } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';
import { DbxSectionComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DbxSectionComponent, DocFeatureCardListComponent]
})
export class DocActionHomeComponent {
  cards: DocFeatureCard[] = DOC_ACTION_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
