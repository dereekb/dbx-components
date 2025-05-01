import { Component } from '@angular/core';
import { SegueRef, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { DbxTwoColumnComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.component';
import { DbxTwoColumnContextDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.context.directive';
import { DbxTwoBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/block/two.block.component';
import { DbxTwoColumnColumnHeadDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.head.directive';
import { DbxTwoColumnRightComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.right.component';
import { MatIcon } from '@angular/material/icon';
import { DbxTwoColumnFullLeftDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.full.left.directive';
import { DbxTwoColumnSrefShowRightDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.sref.showright.directive';
import { DbxTwoColumnSrefDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.sref.directive';
import { DbxAnchorListComponent } from '../../../../../../../../../packages/dbx-web/src/lib/router/layout/anchorlist/anchorlist.component';
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
