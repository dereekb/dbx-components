import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UIRouterModule } from '@uirouter/angular';
import { ClickableAnchorLink, provideDbxUIRouterService } from '@dereekb/dbx-core';
import { APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { DbxNavbarComponent } from './navbar.component';
import { provideDbxRouterWebUiRouterProviderConfig } from '../../provider/uirouter/uirouter.router.providers';
import { provideDbxScreenMediaService } from '../../../screen/screen.providers';

describe('NavbarComponent', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BrowserModule, NoopAnimationsModule, DbxNavbarComponent, UIRouterModule.forRoot()],
      declarations: [TestViewComponent],
      providers: [{ provide: APP_BASE_HREF, useValue: '/' }, provideDbxScreenMediaService(), provideDbxUIRouterService(), provideDbxRouterWebUiRouterProviderConfig()]
    }).compileComponents();
  });

  let testComponent: TestViewComponent;
  let fixture: ComponentFixture<TestViewComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestViewComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('with anchors', () => {
    beforeEach(async () => {
      testComponent.anchors = [
        {
          title: 'Test'
        }
      ];

      fixture.detectChanges();
    });

    it('should render', () => {
      // TODO

      expect(true).toBe(true);
    });
  });
});

@Component({
  template: `
    <dbx-navbar [anchors]="anchors"></dbx-navbar>
  `
})
class TestViewComponent {
  @Input()
  public anchors?: ClickableAnchorLink[];
}
