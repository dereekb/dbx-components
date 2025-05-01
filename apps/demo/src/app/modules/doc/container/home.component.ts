import { DOC_ROUTES } from './../doc';
import { Component } from '@angular/core';
import { DocFeatureCard, DocFeatureCardListComponent } from '../modules/shared/component/feature.card.list.component';
import { DbxContentContainerDirective, DbxSectionPageComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxSectionPageComponent, DocFeatureCardListComponent]
})
export class DocHomeComponent {
  cards: DocFeatureCard[] = DOC_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
