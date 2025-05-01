import { DOC_ACTION_ROUTES } from '../doc.action';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';
import { DbxSectionComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/section/section.component';
import { DocFeatureCardListComponent } from '../../shared/component/feature.card.list.component';

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
