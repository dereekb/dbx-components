import { DOC_ROUTES } from './../doc';
import { Component } from '@angular/core';
import { DocFeatureCard, DocFeatureCardListComponent } from '../modules/shared/component/feature.card.list.component';
import { DbxContentContainerDirective } from '../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DbxSectionPageComponent } from '../../../../../../../packages/dbx-web/src/lib/layout/section/section.page.component';

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
