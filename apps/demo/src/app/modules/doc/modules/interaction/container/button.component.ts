import { Component } from '@angular/core';
import { DbxButtonDisplayContent } from '@dereekb/dbx-core';
import { DbxProgressButtonOptions } from '@dereekb/dbx-web';
import { Milliseconds } from '@dereekb/util';

const DEMO_SPINNER_TIME: Milliseconds = 3350;

@Component({
  templateUrl: './button.component.html'
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

  buttonDisplay1: DbxButtonDisplayContent = {
    icon: 'radio_button_checked',
    text: 'Magic Button'
  };

  buttonDisplay2: DbxButtonDisplayContent = {
    icon: 'radio_button_unchecked'
  };

  demoButton1: DbxProgressButtonOptions = {
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

  demoButton2: DbxProgressButtonOptions = {
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

  spinnerButtonOptions: DbxProgressButtonOptions = {
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

  spinnerButtonOptions1: DbxProgressButtonOptions = {
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

  spinnerButtonOptions2: DbxProgressButtonOptions = {
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

  spinnerButtonOptions3: DbxProgressButtonOptions = {
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

  spinnerButtonOptions8: DbxProgressButtonOptions = {
    working: false,
    spinnerSize: 19,
    raised: false,
    stroked: false,
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

  spinnerButtonOptions4: DbxProgressButtonOptions = {
    working: false,
    text: 'Fab',
    spinnerSize: 25, // ignored
    raised: false,
    stroked: false,
    flat: false,
    fab: true,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate',
    buttonIcon: {
      fontIcon: 'settings'
    }
  };

  spinnerButtonOptions5: DbxProgressButtonOptions = {
    ...this.spinnerButtonOptions3,
    text: '',
    spinnerSize: undefined
  };

  spinnerButtonOptions6: DbxProgressButtonOptions = {
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

  barButtonOptions: DbxProgressButtonOptions = {
    text: 'Stroked Button'
  };

  barButtonOptionsWorkingState = false;

  barButtonOptions1: DbxProgressButtonOptions = {
    ...this.demoButton2,
    text: 'Raised Button'
  };

  barButtonOptions2: DbxProgressButtonOptions = {
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

  barButtonOptions3: DbxProgressButtonOptions = {
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

  barButtonOptions4: DbxProgressButtonOptions = {
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

  clickSpin1 = this.activateAndDeactivate('spinnerButtonOptions');
  clickSpin2 = this.activateAndDeactivate('spinnerButtonOptions1');
  clickSpin3 = this.activateAndDeactivate('spinnerButtonOptions2');
  clickSpin4 = this.activateAndDeactivate('spinnerButtonOptions3');
  clickSpin5 = this.activateAndDeactivate('spinnerButtonOptions4');
  clickSpin6 = this.activateAndDeactivate('spinnerButtonOptions5');
  clickSpin7 = this.activateAndDeactivate('spinnerButtonOptions6');

  clickBar1 = () => {
    this.barButtonOptionsWorkingState = true;
    setTimeout(() => {
      this.barButtonOptionsWorkingState = false;
    }, DEMO_SPINNER_TIME);
  };

  clickBar2 = this.activateAndDeactivate('barButtonOptions1');
  clickBar3 = this.activateAndDeactivate('barButtonOptions2');
  clickBar4 = this.activateAndDeactivate('barButtonOptions3');
  clickBar5 = this.activateAndDeactivate('barButtonOptions4');
}
