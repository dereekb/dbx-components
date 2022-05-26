import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { DbxSpinnerButtonComponent } from './spinner.button.component';
import { DbxProgressButtonsModule } from './button.progress.module';
import { DBX_MAT_PROGRESS_BUTTON_GLOBAL_CONFIG } from './button.progress.config';

describe('DbxSpinnerButtonComponent', () => {
  let component: DbxSpinnerButtonComponent;
  let fixture: ComponentFixture<DbxSpinnerButtonComponent>;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [DbxProgressButtonsModule.forRoot([{ active: true, text: 'test' }])],
        providers: [{ provide: DBX_MAT_PROGRESS_BUTTON_GLOBAL_CONFIG, useValue: { active: true, text: 'test' } }]
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(DbxSpinnerButtonComponent);
    component = fixture.componentInstance;
    component.options = {
      spinnerColor: 'primary',
      active: false,
      buttonColor: 'primary',
      text: 'test button',
      disabled: false
    };
    fixture.detectChanges();
  });

  it('should create DbxSpinnerButtonComponent', () => {
    expect(component).toBeTruthy();
  });

  /*
  it('should emit on click if not active or disabled', () => {
    const spy = jasmine.createSpy('DbxSpinnerButtonComponentBtnClick');
    component.btnClick.subscribe(spy);

    const event = new MouseEvent('click', { bubbles: true });
    component.handleClick(event);

    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(event);
  });

  it('should NOT emit on click if active', () => {
    const spy = jasmine.createSpy('DbxSpinnerButtonComponentBtnClick');
    component.btnClick.subscribe(spy);

    component.options = { active: true, text: 'test button' };
    const event = new MouseEvent('click', { bubbles: true });
    component.handleClick(event);

    expect(spy).not.toHaveBeenCalled();
  });

  it('should NOT emit on click if disabled', () => {
    const spy = jest.spyOn('DbxSpinnerButtonComponentBtnClick');
    component.btnClick.subscribe(spy);

    component.options = { active: false, disabled: true, text: 'test button' };
    const event = new MouseEvent('click', { bubbles: true });
    component.handleClick(event);

    expect(spy).not.toHaveBeenCalled();
  });
  */
});
