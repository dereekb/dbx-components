import { Component } from '@angular/core';
import { SegueRef, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { DbxTwoColumnComponent } from '@dereekb/dbx-web';
import { DbxTwoColumnContextDirective } from '@dereekb/dbx-web';
import { DbxTwoBlockComponent } from '@dereekb/dbx-web';
import { DbxTwoColumnColumnHeadDirective } from '@dereekb/dbx-web';
import { DbxTwoColumnRightComponent } from '@dereekb/dbx-web';
import { MatIcon } from '@angular/material/icon';
import { DbxTwoColumnFullLeftDirective } from '@dereekb/dbx-web';
import { DbxTwoColumnSrefShowRightDirective } from '@dereekb/dbx-web';
import { DbxTwoColumnSrefDirective } from '@dereekb/dbx-web';
import { DbxAnchorListComponent } from '@dereekb/dbx-web';
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
