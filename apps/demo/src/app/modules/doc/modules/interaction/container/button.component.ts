import { Component } from '@angular/core';
import { DbxProgressButtonOptions } from '@dereekb/dbx-web';

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
      this[key] = { ...this[key], active: true };
      setTimeout(() => {
        this[key] = { ...this[key], active: false };
      }, 3350);
    };
  }

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
    active: false,
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
    active: false,
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
    active: false,
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
    active: false,
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

  spinnerButtonOptions4: DbxProgressButtonOptions = {
    active: false,
    text: 'Fab',
    spinnerSize: 19,
    raised: false,
    stroked: false,
    flat: false,
    fab: true,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate',
    icon: {
      fontIcon: 'settings',
      inline: true
    }
  };

  spinnerButtonOptions5: DbxProgressButtonOptions = {
    ...this.spinnerButtonOptions3,
    text: '',
    spinnerSize: undefined
  };

  barButtonOptions: DbxProgressButtonOptions = {
    text: 'Stroked Button'
  };

  barButtonOptionsActiveState = false;

  barButtonOptions1: DbxProgressButtonOptions = {
    ...this.demoButton2,
    text: 'Raised Button'
  };

  barButtonOptions2: DbxProgressButtonOptions = {
    active: false,
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
    active: false,
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

  clickSpin1 = this.activateAndDeactivate('spinnerButtonOptions');
  clickSpin2 = this.activateAndDeactivate('spinnerButtonOptions1');
  clickSpin3 = this.activateAndDeactivate('spinnerButtonOptions2');
  clickSpin4 = this.activateAndDeactivate('spinnerButtonOptions3');
  clickSpin5 = this.activateAndDeactivate('spinnerButtonOptions4');
  clickSpin6 = this.activateAndDeactivate('spinnerButtonOptions5');

  clickBar1 = () => {
    this.barButtonOptionsActiveState = true;
    setTimeout(() => {
      this.barButtonOptionsActiveState = false;
    }, 3350);
  };

  clickBar2 = this.activateAndDeactivate('barButtonOptions1');
  clickBar3 = this.activateAndDeactivate('barButtonOptions2');
  clickBar4 = this.activateAndDeactivate('barButtonOptions3');
}
