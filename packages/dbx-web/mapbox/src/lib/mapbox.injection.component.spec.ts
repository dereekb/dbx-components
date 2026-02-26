import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { DbxMapboxInjectionComponent } from './mapbox.injection.component';
import { DbxMapboxInjectionStore } from './mapbox.injection.store';
import { BrowserModule } from '@angular/platform-browser';

describe('DbxMapboxInjectionComponent', () => {
  let component: DbxMapboxInjectionComponent;
  let fixture: ComponentFixture<DbxMapboxInjectionComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [BrowserModule, DbxMapboxInjectionComponent],
      providers: [DbxMapboxInjectionStore]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DbxMapboxInjectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have a defined injection store', () => {
    expect(component.dbxMapboxMapKeyInjectionStore).toBeDefined();
  });

  it('should have an entries signal', () => {
    expect(component.entriesSignal).toBeDefined();
  });

  it('should render without errors', () => {
    expect(fixture.nativeElement).toBeTruthy();
  });
});
