import { DbxInjectedTemplateConfig, DbxInjectedComponentConfig } from './injected';
import { DbxInjectedComponent } from './injected.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Type, ViewChild } from '@angular/core';
import { By, BrowserModule } from '@angular/platform-browser';
import { DbxInjectedComponentModule } from './injected.component.module';

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
  config?: DbxInjectedComponentConfig;

  @Input()
  template?: DbxInjectedTemplateConfig;

  @ViewChild(DbxInjectedComponent, { static: true })
  injectedComponent?: DbxInjectedComponent<T>;

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

describe('DbxInjectedComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        BrowserModule,
        DbxInjectedComponentModule
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

        // todo: test injecting data.

      });

    });

  }

});
