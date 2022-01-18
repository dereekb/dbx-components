import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { DbNgxLoadingModule } from './loading.module';
import { By } from '@angular/platform-browser';
import { DbNgxLoadingProgressComponent } from './loading-progress.component';
import { ErrorInput } from '@dereekb/util'
import { DbNgxBasicLoadingComponent } from './basic-loading.component';
import { DbNgxReadableErrorComponent } from '../error/error.component';

describe('DbNgxBasicLoadingComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DbNgxLoadingModule],
      declarations: [BasicLoadingWithContentComponent, BasicLoadingWithCustomErrorComponent, BasicLoadingWithCustomLoadingComponent]
    }).compileComponents();
  });

  describe('with content', () => {
    let fixture: ComponentFixture<BasicLoadingWithContentComponent>;
    let component: BasicLoadingWithContentComponent;

    beforeEach(() => {
      fixture = TestBed.createComponent(BasicLoadingWithContentComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should display the content while not loading.', () => {
      const testContent: HTMLElement = fixture.debugElement.query(By.css('#test-content')).nativeElement;
      expect(testContent).not.toBeNull();
      expect(testContent.textContent).toBe(TEST_CONTENT);
    });

    describe('and loading', () => {

      beforeEach(() => {
        component.loading = true;
        fixture.detectChanges();
      });

      it('should not display the content.', () => {
        const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
        expect(testContentQueryResult).toBeNull();
      });

      it('should display the loading progress view.', () => {
        const loadingProgressQueryResult = fixture.debugElement.query(By.directive(DbNgxLoadingProgressComponent));
        expect(loadingProgressQueryResult).not.toBeNull();
      });

      it('should not detect custom loading content (that does not exist).', () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.component!.hasCustomLoading).toBe(false);
      });

    });

    describe('and error', () => {

      beforeEach(() => {
        component.error = {
          code: 'Test',
          message: 'Test'
        };

        fixture.detectChanges();
      });

      it('should not display the content.', () => {
        const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
        expect(testContentQueryResult).toBeNull();
      });

      it('should display the error view.', () => {
        const errorComponentQueryResult = fixture.debugElement.query(By.directive(DbNgxReadableErrorComponent));
        expect(errorComponentQueryResult).not.toBeNull();
      });

      it('should not detect custom error content (that does not exist).', () => {
        fixture.detectChanges();
        expect(fixture.componentInstance.component!.hasCustomError).toBe(false);
      });

    });

  });

  describe('with custom error', () => {
    let fixture: ComponentFixture<BasicLoadingWithCustomErrorComponent>;
    let component: BasicLoadingWithCustomErrorComponent;

    beforeEach(async () => {
      fixture = TestBed.createComponent(BasicLoadingWithCustomErrorComponent);
      component = fixture.componentInstance;

      component.error = {
        code: 'Test',
        message: 'Test'
      };

      fixture.detectChanges();
    });

    it('should display the custom error content on error.', () => {
      const customError: HTMLElement = fixture.debugElement.query(By.css('#test-error')).nativeElement;
      expect(customError).not.toBeNull();
      expect(customError.textContent).toBe(CUSTOM_ERROR_CONTENT);
    });

    it('should detect the custom loading content.', () => {
      fixture.detectChanges();
      expect(fixture.componentInstance.component!.hasCustomError).toBe(true);
    });

  });

  describe('with custom loading', () => {
    let fixture: ComponentFixture<BasicLoadingWithCustomLoadingComponent>;
    let component: BasicLoadingWithCustomLoadingComponent;

    beforeEach(async () => {
      fixture = TestBed.createComponent(BasicLoadingWithCustomLoadingComponent);
      component = fixture.componentInstance;
      component.loading = true;
      fixture.detectChanges();
    });

    it('should display the custom loading content while loading.', () => {
      fixture.detectChanges();

      const customLoading: HTMLElement = fixture.debugElement.query(By.css('#custom-loading')).nativeElement;
      expect(customLoading).not.toBeNull();
      expect(customLoading.textContent).toBe(CUSTOM_LOADING_CONTENT);
    });

    it('should detect the custom loading content.', () => {
      fixture.detectChanges();
      expect(fixture.componentInstance.component!.hasCustomLoading).toBe(true);
    });

  });

});

const TEST_CONTENT = 'Content';
const CUSTOM_LOADING_CONTENT = 'Custom Loading...';
const CUSTOM_ERROR_CONTENT = 'Error.';

@Component({
  template: `
    <dbx-basic-loading [waitFor]="loading" [error]="error">
      <div>
        <p id="test-content">${TEST_CONTENT}</p>
      </div>
    </dbx-basic-loading>
  `
})
class BasicLoadingWithContentComponent {

  public loading = false;

  public error?: ErrorInput;

  @ViewChild(DbNgxBasicLoadingComponent, { static: true })
  public readonly component?: DbNgxBasicLoadingComponent;

}

@Component({
  template: `
    <dbx-basic-loading [error]="error">
      <div error>
        <p id="test-error">${CUSTOM_ERROR_CONTENT}</p>
      </div>
    </dbx-basic-loading>
  `
})
class BasicLoadingWithCustomErrorComponent {

  public error?: ErrorInput;

  @ViewChild(DbNgxBasicLoadingComponent, { static: true })
  public readonly component?: DbNgxBasicLoadingComponent;

}

@Component({
  template: `
    <dbx-basic-loading [waitFor]="loading">
      <div>Content</div>
      <div loading>
        <p id="custom-loading">${CUSTOM_LOADING_CONTENT}</p>
      </div>
    </dbx-basic-loading>
  `
})
class BasicLoadingWithCustomLoadingComponent {

  public loading = false;

  @ViewChild(DbNgxBasicLoadingComponent, { static: true })
  public readonly component?: DbNgxBasicLoadingComponent;

}
