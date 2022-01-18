import { DbNgxInjectedTemplateConfig } from '@dereekb/ngx-core';
import { DbNgxInjectedComponentConfig } from '@dereekb/ngx-core';
import { DbNgxInjectedComponent } from './injected.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Type, ViewChild } from '@angular/core';
import { By, BrowserModule } from '@angular/platform-browser';
import { AnchorType, ClickableAnchor, DbNgxInjectedComponentModule } from '@dereekb/ngx-core';
import { first } from 'rxjs/operators';

const CUSTOM_CONTENT_ID = 'custom-content';
const CUSTOM_CONTENT = 'Custom Content';

@Component({
  template: `
    <span id="${CUSTOM_CONTENT_ID}">${CUSTOM_CONTENT}</span>
  `
})
class TestInjectedComponentContent { }

@Component({})
abstract class TestInjectedComponent<T = any> {

  @Input()
  config?: DbNgxInjectedComponentConfig;

  @Input()
  template?: DbNgxInjectedTemplateConfig;

  @ViewChild(DbNgxInjectedComponent, { static: true })
  injectedComponent?: DbNgxInjectedComponent<T>;

}

@Component({
  template: `
    <div dbx-injected-content [config]="config" [template]="template"></div>
  `
})
class TestInjectedComponentWithElement<T = any> extends TestInjectedComponent<T> { }

@Component({
  template: `
    <dbx-injected-content [config]="config" [template]="template"></dbx-injected-content>
  `
})
class TestInjectedComponentWithAttribute<T = any> extends TestInjectedComponent<T> { }

describe('DbNgxInjectedComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        BrowserModule,
        DbNgxInjectedComponentModule
      ],
      declarations: [
        TestInjectedComponentContent,
        TestInjectedComponentWithElement,
        TestInjectedComponentWithAttribute,
      ],
      providers: []
    }).compileComponents();
  });

  buildTestsWithComponentClass(TestInjectedComponentWithElement, 'element');
  buildTestsWithComponentClass(TestInjectedComponentWithAttribute, 'attribute');

  function buildTestsWithComponentClass<C extends TestInjectedComponent>(type: Type<C>, selector: string): void {

    describe(`selector "${selector}"`, () => {

      let testComponent: TestInjectedComponent;
      let fixture: ComponentFixture<TestInjectedComponent>;

      beforeEach(async () => {
        fixture = TestBed.createComponent(type);
        testComponent = fixture.componentInstance;
        fixture.detectChanges();
      });

      describe('with config', () => {

        beforeEach(async () => {
          testComponent.config = {
            componentClass: TestInjectedComponentContent
          };

          fixture.detectChanges();
        });

        it('should show content', () => {
          const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`#${CUSTOM_CONTENT_ID}`)).nativeElement;
          expect(anchorElement).not.toBeNull();
          expect(anchorElement.textContent).toBe(CUSTOM_CONTENT);
        });


        it('should show destroy the content when config is cleared.', () => {
          const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`#${CUSTOM_CONTENT_ID}`)).nativeElement;
          expect(anchorElement).not.toBeNull();
          expect(anchorElement.textContent).toBe(CUSTOM_CONTENT);



        });

      });

    });

  }

});
