import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DbNgxLoadingModule } from './loading.module';
import { By } from '@angular/platform-browser';
import { DbNgxLoadingProgressComponent } from './loading-progress.component';
import { ErrorInput } from '@dereekb/util'
import { LoadingComponentState, DbNgxBasicLoadingComponent } from './basic-loading.component';
import { DbNgxReadableErrorComponent } from '../error/error.component';
import { filter, first } from 'rxjs';

export function waitForState(state: LoadingComponentState): (component: DbNgxBasicLoadingComponent) => (checkFn: () => void) => void {
  return (component: DbNgxBasicLoadingComponent) => {
    return (checkFn: () => void) => {
      component.state$.pipe(
        filter(x => x === state), first()
      ).subscribe(checkFn);
    };
  };
}

describe('DbNgxBasicLoadingComponent', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DbNgxLoadingModule],
      declarations: [BasicLoadingWithContentComponent, BasicLoadingWithCustomErrorComponent, BasicLoadingWithCustomLoadingComponent]
    }).compileComponents();
  });

  describe('with content', () => {

    let fixture: ComponentFixture<BasicLoadingWithContentComponent>;
    let component: BasicLoadingWithContentComponent;

    let waitForComponentToBeLoading: (checkFn: () => void) => void;
    let waitForComponentToHaveContent: (checkFn: () => void) => void;
    let waitForComponentToHaveError: (checkFn: () => void) => void;

    beforeEach(() => {
      fixture = TestBed.createComponent(BasicLoadingWithContentComponent);
      component = fixture.componentInstance;

      component.loading = false;
      fixture.detectChanges();

      waitForComponentToBeLoading = waitForState(LoadingComponentState.LOADING)(component.component!);
      waitForComponentToHaveContent = waitForState(LoadingComponentState.CONTENT)(component.component!);
      waitForComponentToHaveError = waitForState(LoadingComponentState.ERROR)(component.component!);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the content while not loading.', (done) => {
      waitForComponentToHaveContent(() => {
        expect(component.loading).toBe(false);
        const testContent: HTMLElement = fixture.debugElement.query(By.css('#test-content')).nativeElement;
        expect(testContent).not.toBeNull();
        expect(testContent.textContent).toBe(TEST_CONTENT);
        done();
      });
    });

    describe('and loading', () => {

      beforeEach(async () => {
        component.loading = true;
        fixture.detectChanges();
      });

      it('should not display the content.', (done) => {
        waitForComponentToBeLoading(() => {
          const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
          expect(testContentQueryResult).toBeNull();
          done();
        });
      });

      it('should display the loading progress view.', (done) => {
        waitForComponentToBeLoading(() => {
          fixture.componentInstance.component?.hasNoCustomLoading$.pipe(filter(x => x), first()).subscribe((hasNoCustomLoading) => {
            expect(hasNoCustomLoading).toBe(true);
            const loadingProgressQueryResult = fixture.debugElement.query(By.directive(DbNgxLoadingProgressComponent));
            expect(loadingProgressQueryResult).not.toBeNull();
            done();
          });
        });
      });

      it('should not detect custom loading content (that does not exist).', (done) => {
        waitForComponentToBeLoading(() => {
          fixture.detectChanges();
          fixture.componentInstance.component?.hasNoCustomLoading$.pipe(filter(x => x), first()).subscribe((hasNoCustomLoading) => {
            expect(hasNoCustomLoading).toBe(true);
            done();
          });
        });
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

      it('should not display the content.', (done) => {
        waitForComponentToHaveError(() => {
          const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
          expect(testContentQueryResult).toBeNull();
          done();
        });
      });

      it('should display the error view.', (done) => {
        waitForComponentToHaveError(() => {
          const errorComponentQueryResult = fixture.debugElement.query(By.directive(DbNgxReadableErrorComponent));
          expect(errorComponentQueryResult).not.toBeNull();
          done();
        });
      });

      it('should not detect custom error content (that does not exist).', (done) => {
        waitForComponentToHaveError(() => {
          fixture.detectChanges();
          fixture.componentInstance.component?.hasNoCustomError$.pipe(filter(x => x), first()).subscribe((hasNoCustomError) => {
            expect(hasNoCustomError).toBe(true);
            done();
          });
        });
      });

    });

  });

  describe('with custom error', () => {
    let fixture: ComponentFixture<BasicLoadingWithCustomErrorComponent>;
    let component: BasicLoadingWithCustomErrorComponent;

    let waitForComponentToHaveError: (checkFn: () => void) => void;

    beforeEach(async () => {
      fixture = TestBed.createComponent(BasicLoadingWithCustomErrorComponent);
      component = fixture.componentInstance;
      waitForComponentToHaveError = waitForState(LoadingComponentState.ERROR)(component.component!);

      component.error = {
        code: 'Test',
        message: 'Test'
      };

      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the custom error content on error.', (done) => {
      waitForComponentToHaveError(() => {
        const customError: HTMLElement = fixture.debugElement.query(By.css('#test-error')).nativeElement;
        expect(customError).not.toBeNull();
        expect(customError.textContent).toBe(CUSTOM_ERROR_CONTENT);
        done();
      });
    });

    it('should detect the custom error content.', (done) => {
      waitForComponentToHaveError(() => {
        fixture.componentInstance.component?.hasNoCustomError$.pipe(filter(x => !x), first()).subscribe((hasNoCustomError) => {
          expect(hasNoCustomError).toBe(false);
          done();
        });
      });
    });

  });

  describe('with custom loading', () => {
    let fixture: ComponentFixture<BasicLoadingWithCustomLoadingComponent>;
    let component: BasicLoadingWithCustomLoadingComponent;

    let waitForComponentToBeLoading: (checkFn: () => void) => void;

    beforeEach(async () => {
      fixture = TestBed.createComponent(BasicLoadingWithCustomLoadingComponent);
      component = fixture.componentInstance;
      component.loading = true;
      fixture.detectChanges();
      waitForComponentToBeLoading = waitForState(LoadingComponentState.LOADING)(component.component!);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the custom loading content while loading.', (done) => {
      waitForComponentToBeLoading(() => {
        const customLoading: HTMLElement = fixture.debugElement.query(By.css('#custom-loading')).nativeElement;
        expect(customLoading).not.toBeNull();
        expect(customLoading.textContent).toBe(CUSTOM_LOADING_CONTENT);
        done();
      });
    });

    it('should detect the custom loading content.', (done) => {
      waitForComponentToBeLoading(() => {
        fixture.detectChanges();
        fixture.componentInstance.component?.hasNoCustomLoading$.pipe(filter(x => !x), first()).subscribe((hasNoCustomLoading) => {
          expect(hasNoCustomLoading).toBe(false);
          done();
        });
      });
    });

  });

});

const TEST_CONTENT = 'Content';
const CUSTOM_LOADING_CONTENT = 'Custom Loading...';
const CUSTOM_ERROR_CONTENT = 'Error.';

@Component({
  template: `
    <dbx-basic-loading [loading]="loading" [error]="error">
      <div>
        <p id="test-content">${TEST_CONTENT}</p>
      </div>
    </dbx-basic-loading>
  `
})
class BasicLoadingWithContentComponent {

  public loading = true;

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
    <dbx-basic-loading [loading]="loading">
      <div>Content</div>
      <div loading>
        <p id="custom-loading">${CUSTOM_LOADING_CONTENT}</p>
      </div>
    </dbx-basic-loading>
  `
})
class BasicLoadingWithCustomLoadingComponent {

  public loading = true;

  @ViewChild(DbNgxBasicLoadingComponent, { static: true })
  public readonly component?: DbNgxBasicLoadingComponent;

}
