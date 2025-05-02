import { Component } from '@angular/core';
import { DbxButtonDisplay } from '@dereekb/dbx-core';
import { DbxProgressButtonConfig, DbxContentContainerDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxIconButtonComponent, DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent, DbxContentPitDirective, DbxColorDirective } from '@dereekb/dbx-web';
import { Milliseconds } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatIcon } from '@angular/material/icon';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';

const DEMO_SPINNER_TIME: Milliseconds = 3350;

@Component({
  templateUrl: './button.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxButtonComponent, DbxButtonSpacerDirective, MatIcon, DbxIconButtonComponent, DocFeatureDerivedComponent, DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent, DbxContentPitDirective, DbxColorDirective]
})
export class DocInteractionButtonComponent {
  testClicked = '';

  onTestClick() {
    this.testClicked = `Clicked! ${new Date().getTime()}`;
  }

  activateAndDeactivate(key: keyof this) {
    return () => {
      this[key] = { ...this[key], working: true };
      setTimeout(() => {
        this[key] = { ...this[key], working: false };
      }, DEMO_SPINNER_TIME);
    };
  }

  buttonDisplay1: DbxButtonDisplay = {
    icon: 'radio_button_checked',
    text: 'Magic Button'
  };

  buttonDisplay2: DbxButtonDisplay = {
    icon: 'radio_button_unchecked'
  };

  demoButton1: DbxProgressButtonConfig = {
    id: 'button1',
    text: 'Stroked Button',
    buttonColor: 'accent',
    barColor: 'accent',
    raised: false,
    stroked: true,
    mode: 'indeterminate',
    value: 0,
    disabled: false,
    customClass: 'some-other-class',
    buttonIcon: {
      fontIcon: 'favorite'
    }
  };

  demoButton2: DbxProgressButtonConfig = {
    id: 'button2',
    text: 'Raised Button',
    buttonColor: 'primary',
    barColor: 'primary',
    raised: true,
    stroked: false,
    mode: 'indeterminate',
    value: 0,
    disabled: false
  };

  spinnerButtonConfig: DbxProgressButtonConfig = {
    working: false,
    text: 'Stroked Button',
    spinnerSize: 19,
    raised: false,
    stroked: true,
    buttonColor: 'accent',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate',
    customClass: 'some-class',
    buttonIcon: {
      fontIcon: 'favorite'
    }
  };

  spinnerButtonConfig1: DbxProgressButtonConfig = {
    working: false,
    text: 'Raised Button',
    spinnerSize: 19,
    raised: true,
    stroked: false,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate'
  };

  spinnerButtonConfig2: DbxProgressButtonConfig = {
    working: false,
    text: 'Default Button',
    spinnerSize: 19,
    raised: false,
    stroked: false,
    buttonColor: 'primary',
    spinnerColor: 'primary',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate'
  };

  spinnerButtonConfig3: DbxProgressButtonConfig = {
    working: false,
    text: 'Flat Button',
    spinnerSize: 19,
    raised: false,
    stroked: false,
    flat: true,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate'
  };

  spinnerButtonConfig8: DbxProgressButtonConfig = {
    working: false,
    spinnerSize: 19,
    raised: false,
    stroked: false,
    text: 'HELLO WORLD',
    flat: true,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    buttonIcon: {
      fontIcon: 'settings'
    },
    mode: 'indeterminate'
  };

  spinnerButtonConfig4: DbxProgressButtonConfig = {
    working: false,
    spinnerSize: 25, // ignored
    raised: false,
    stroked: false,
    flat: false,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate',
    buttonIcon: {
      fontIcon: 'settings'
    }
  };

  spinnerButtonConfig5: DbxProgressButtonConfig = {
    ...this.spinnerButtonConfig3,
    text: '',
    spinnerSize: undefined
  };

  spinnerButtonConfig6: DbxProgressButtonConfig = {
    working: false,
    text: 'Icon', // ignored
    spinnerSize: 25, // ignored
    iconOnly: true,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate',
    buttonIcon: {
      fontIcon: 'settings'
    }
  };

  spinnerButtonConfig6Fab: DbxProgressButtonConfig = {
    ...this.spinnerButtonConfig6,
    fab: true
  };

  barButtonConfig: DbxProgressButtonConfig = {
    text: 'Stroked Button'
  };

  barButtonConfigWorkingState = false;

  barButtonConfig1: DbxProgressButtonConfig = {
    ...this.demoButton2,
    text: 'Raised Button'
  };

  barButtonConfig2: DbxProgressButtonConfig = {
    working: false,
    text: 'Default Button',
    buttonColor: 'primary',
    barColor: 'primary',
    raised: false,
    stroked: false,
    mode: 'indeterminate',
    value: 0,
    disabled: false
  };

  barButtonConfig3: DbxProgressButtonConfig = {
    working: false,
    text: 'Flat Button',
    buttonColor: 'primary',
    barColor: 'primary',
    raised: false,
    stroked: false,
    flat: true,
    mode: 'indeterminate',
    value: 0,
    disabled: false
  };

  barButtonConfig4: DbxProgressButtonConfig = {
    working: false,
    text: 'Flat Button',
    buttonColor: 'ok',
    barColor: 'success',
    raised: false,
    stroked: false,
    flat: true,
    mode: 'indeterminate',
    value: 0,
    disabled: false
  };

  clickSpin1 = this.activateAndDeactivate('spinnerButtonConfig');
  clickSpin2 = this.activateAndDeactivate('spinnerButtonConfig1');
  clickSpin3 = this.activateAndDeactivate('spinnerButtonConfig2');
  clickSpin4 = this.activateAndDeactivate('spinnerButtonConfig3');
  clickSpin5 = this.activateAndDeactivate('spinnerButtonConfig4');
  clickSpin6 = this.activateAndDeactivate('spinnerButtonConfig5');
  clickSpin7 = this.activateAndDeactivate('spinnerButtonConfig6');
  clickSpin8 = this.activateAndDeactivate('spinnerButtonConfig6Fab');

  clickBar1 = () => {
    this.barButtonConfigWorkingState = true;
    setTimeout(() => {
      this.barButtonConfigWorkingState = false;
    }, DEMO_SPINNER_TIME);
  };

  clickBar2 = this.activateAndDeactivate('barButtonConfig1');
  clickBar3 = this.activateAndDeactivate('barButtonConfig2');
  clickBar4 = this.activateAndDeactivate('barButtonConfig3');
  clickBar5 = this.activateAndDeactivate('barButtonConfig4');
}
