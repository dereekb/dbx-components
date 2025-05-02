import { Component } from '@angular/core';
import { SegueRef, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxTwoColumnComponent, DbxTwoColumnContextDirective, DbxTwoBlockComponent, DbxTwoColumnColumnHeadDirective, DbxTwoColumnRightComponent, DbxTwoColumnFullLeftDirective, DbxTwoColumnSrefShowRightDirective, DbxTwoColumnSrefDirective, DbxAnchorListComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './two.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, MatButton, DbxTwoColumnComponent, DbxTwoColumnContextDirective, DbxTwoBlockComponent, DbxTwoColumnColumnHeadDirective, DbxTwoColumnRightComponent, MatIconButton, MatIcon, DbxTwoColumnFullLeftDirective, DbxTwoColumnSrefShowRightDirective, DbxTwoColumnSrefDirective, DbxAnchorListComponent, UIView]
})
export class DocLayoutTwoColumnsComponent {
  showRight = true;

  readonly twoRef: SegueRef = {
    ref: 'doc.layout.two'
  };

  readonly childAnchors: ClickableAnchorLinkTree[] = [
    {
      title: 'Parent View',
      ref: 'doc.layout.two'
    },
    {
      title: 'Child View',
      ref: 'doc.layout.two.child'
    }
  ];
}
