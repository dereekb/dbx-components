import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { type SegueRef, type ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxTwoColumnComponent, DbxTwoColumnContextDirective, DbxTwoBlockComponent, DbxTwoColumnColumnHeadDirective, DbxTwoColumnRightComponent, DbxTwoColumnFullLeftDirective, DbxTwoColumnSrefShowRightDirective, DbxTwoColumnSrefDirective, DbxAnchorListComponent, DbxValueListItemModifierDirective, DbxListItemAnchorModifierDirective, type AnchorForValueFunction } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { UIView } from '@uirouter/angular';
import { DocTwoColumnSrefListComponent, type TwoColumnSrefValue } from '../component/two.column.sref.list.component';

@Component({
  templateUrl: './two.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, MatButton, DbxTwoColumnComponent, DbxTwoColumnContextDirective, DbxTwoBlockComponent, DbxTwoColumnColumnHeadDirective, DbxTwoColumnRightComponent, MatIconButton, MatIcon, DbxTwoColumnFullLeftDirective, DbxTwoColumnSrefShowRightDirective, DbxTwoColumnSrefDirective, DbxAnchorListComponent, DocTwoColumnSrefListComponent, DbxValueListItemModifierDirective, DbxListItemAnchorModifierDirective, UIView],
  changeDetection: ChangeDetectionStrategy.OnPush
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

  // Distinct sibling child routes fed to a `dbx-list` value list to mirror the hellosubs configuration.
  // Each row is its own leaf route, so exactly one row is the active route at a time.
  readonly childListState$: Observable<ListLoadingState<TwoColumnSrefValue>> = of(
    successResult<TwoColumnSrefValue[]>([
      { title: 'Item One', ref: 'doc.layout.two.itemOne' },
      { title: 'Item Two', ref: 'doc.layout.two.itemTwo' },
      { title: 'Item Three', ref: 'doc.layout.two.itemThree' }
    ])
  );

  // Turns each row into a segue-ref anchor (uiSref), exactly like hellosubs' dbxListItemAnchorModifier usage.
  readonly makeChildAnchor: AnchorForValueFunction<TwoColumnSrefValue> = (value) => ({ ref: value.ref });
}
