import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective, DbxAvatarComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './avatar.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocLayoutAvatarComponent {
  readonly demoAvatarUrl = 'https://www.gravatar.com/avatar/205d5c6f1f0075bf8cb6a6021b223206';
  readonly demoBrokenAvatarUrl = 'https://components.dereeekb.com/assets/images/avatars/doesNotExist.jpg';

  readonly demoAvatarNames = ['Michelle B', 'John Smith', 'Derek Burgman', 'Zoe Quinn', 'Wendy Carlos', 'Alan Turing', 'Grace Hopper', 'Quinn T'];
  readonly demoAvatarCharacters = ['A', 'BB', 'CD', 'Z'];
}
