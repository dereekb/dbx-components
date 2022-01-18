import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbNgxLoadingModule } from './loading.module';
import { By } from '@angular/platform-browser';
import { AppLoadingProgressComponent } from './loading-progress.component';
import { ValuesLoadingContext } from '@dereekb/util-rxjs';
import { DbNgxReadableErrorComponent } from '../error';

describe('AppLoadingComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbNgxLoadingModule
      ],
      declarations: [LoadingComponent]
    }).compileComponents();
  });

  describe('with content', () => {
    let fixture: ComponentFixture<LoadingComponent>;
    let component: LoadingComponent;

    beforeEach(async () => {
      fixture = TestBed.createComponent(LoadingComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should display the content if not loading and no error.', () => {
      component.context.setLoading(false);
      fixture.detectChanges();

      const testContent: HTMLElement = fixture.debugElement.query(By.css('#test-content')).nativeElement;
      expect(testContent).not.toBeNull();
      expect(testContent.textContent).toBe(TEST_CONTENT);
    });

    describe('and error', () => {

      beforeEach(async () => {
        component.context.setError({
          code: 'Test',
          message: 'Test'
        });

        fixture.detectChanges();
      });

      it('should display the error.', () => {
        const errorComponentQueryResult = fixture.debugElement.query(By.directive(DbNgxReadableErrorComponent));
        expect(errorComponentQueryResult).not.toBeNull();
      });

      it('should not display the content.', () => {
        const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
        expect(testContentQueryResult).toBeNull();
      });

    });

    describe('and loading', () => {

      beforeEach(() => {
        component.context.setLoading(true);
        fixture.detectChanges();
      });

      it('should display the loading progress view while loading.', () => {
        const loadingProgressQueryResult = fixture.debugElement.query(By.directive(AppLoadingProgressComponent));
        expect(loadingProgressQueryResult).not.toBeNull();
      });

    });

  });

});

const TEST_CONTENT = 'Content';

@Component({
  template: `
    <dbx-loading [context]="context" [text]="text" [show]="show">
      <div>
        <p id="test-content">${TEST_CONTENT}</p>
      </div>
    </dbx-loading>
  `
})
class LoadingComponent {

  public show?: boolean;

  public text?: string;

  public context = new ValuesLoadingContext();

}
