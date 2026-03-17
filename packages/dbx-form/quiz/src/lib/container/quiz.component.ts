import { Component, computed, effect, inject, input, type Signal } from '@angular/core';
import { QuizStore } from '../store/quiz.store';
import { type Maybe } from '@dereekb/util';
import { type Quiz } from '../store/quiz';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, first, map, type Observable, switchMap } from 'rxjs';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { NgTemplateOutlet } from '@angular/common';
import { provideCurrentQuestionQuizQuestionAccessor } from '../store/quiz.accessor';
import { DbxButtonModule, DbxWindowKeyDownListenerDirective } from '@dereekb/dbx-web';

/**
 * Lifecycle state of the quiz container view.
 */
export type QuizComponentState = 'init' | 'pre-quiz' | 'quiz' | 'post-quiz';

/**
 * Discriminated union of view configs, one per quiz lifecycle state.
 */
export type QuizComponentViewConfig = QuizComponentViewInitConfig | QuizComponentViewPreQuizConfig | QuizComponentViewQuizConfig | QuizComponentViewPostQuizConfig;

export interface QuizComponentViewInitConfig {
  readonly state: 'init';
}

export interface QuizComponentViewPreQuizConfig {
  readonly state: 'pre-quiz';
  readonly preQuizComponent?: Maybe<DbxInjectionComponentConfig>;
}

export interface QuizComponentViewQuizConfig {
  readonly state: 'quiz';
  readonly questionComponent?: Maybe<DbxInjectionComponentConfig>;
  readonly answerComponent?: Maybe<DbxInjectionComponentConfig>;
}

export interface QuizComponentViewPostQuizConfig {
  readonly state: 'post-quiz';
  readonly resultsComponent?: Maybe<DbxInjectionComponentConfig>;
}

/**
 * Top-level quiz container that orchestrates pre-quiz, active quiz, and post-quiz views.
 *
 * Provides its own `QuizStore` and `QuizQuestionAccessor`, so child components injected via
 * `DbxInjectionComponent` can access quiz state directly through DI.
 *
 * Supports keyboard navigation: Enter (start / next), ArrowLeft (previous), ArrowRight (next).
 *
 * @example
 * ```html
 * <dbx-quiz [quiz]="myQuiz"></dbx-quiz>
 * ```
 */
@Component({
  selector: 'dbx-quiz',
  templateUrl: './quiz.component.html',
  imports: [DbxInjectionComponent, DbxButtonModule, DbxWindowKeyDownListenerDirective, NgTemplateOutlet],
  providers: [QuizStore, provideCurrentQuestionQuizQuestionAccessor()],
  standalone: true
})
export class QuizComponent {
  readonly quizStore = inject(QuizStore);
  readonly quiz = input.required<Maybe<Quiz>>();

  readonly keysFilter = ['Enter', 'ArrowLeft', 'ArrowRight'];

  readonly quizEffect = effect(
    () => {
      const quiz = this.quiz();
      this.quizStore.setQuiz(quiz);
    },
    { allowSignalWrites: true }
  );

  readonly quiz$ = toObservable(this.quiz);
  readonly quizTitleSignal = computed(() => this.quiz()?.titleDetails.title);

  readonly currentQuestionSignal = toSignal(this.quizStore.currentQuestion$);

  readonly questionTitleSignal = computed(() => {
    const currentQuestion = this.currentQuestionSignal();
    return currentQuestion ? `Question ${currentQuestion.index + 1}` : '';
  });

  readonly startedQuiz$ = this.quizStore.startedQuiz$;
  readonly currentQuestion$ = this.quizStore.currentQuestion$;

  readonly canGoToPreviousQuestionSignal: Signal<boolean> = toSignal(this.quizStore.canGoToPreviousQuestion$, { initialValue: false });
  readonly canGoToNextQuestionSignal: Signal<boolean> = toSignal(this.quizStore.canGoToNextQuestion$, { initialValue: false });

  readonly viewConfig$: Observable<QuizComponentViewConfig> = this.startedQuiz$.pipe(
    switchMap((started) => {
      if (!started) {
        return this.quiz$.pipe(
          map((quiz) => {
            const viewConfig: QuizComponentViewPreQuizConfig = {
              state: 'pre-quiz',
              preQuizComponent: quiz?.preQuizComponentConfig
            };

            return viewConfig;
          })
        );
      } else {
        return combineLatest([this.quiz$, this.currentQuestion$, this.quizStore.isAtEndOfQuestions$]).pipe(
          map(([quiz, currentQuestion, isAtEndOfQuestions]) => {
            let viewConfig: QuizComponentViewConfig;

            if (isAtEndOfQuestions) {
              viewConfig = {
                state: 'post-quiz',
                resultsComponent: quiz?.resultsComponentConfig
              };
            } else {
              viewConfig = {
                state: 'quiz',
                questionComponent: currentQuestion?.questionComponentConfig,
                answerComponent: currentQuestion?.answerComponentConfig
              };
            }

            return viewConfig;
          })
        );
      }
    })
  );

  readonly viewConfigSignal: Signal<QuizComponentViewConfig> = toSignal(this.viewConfig$, { initialValue: { state: 'init' } as QuizComponentViewConfig });
  readonly viewStateSignal: Signal<QuizComponentState> = computed(() => this.viewConfigSignal()?.state ?? 'init');

  readonly preQuizComponentConfigSignal: Signal<Maybe<DbxInjectionComponentConfig>> = computed(() => (this.viewConfigSignal() as QuizComponentViewPreQuizConfig)?.preQuizComponent);
  readonly questionComponentConfigSignal: Signal<Maybe<DbxInjectionComponentConfig>> = computed(() => (this.viewConfigSignal() as QuizComponentViewQuizConfig)?.questionComponent);
  readonly answerComponentConfigSignal: Signal<Maybe<DbxInjectionComponentConfig>> = computed(() => (this.viewConfigSignal() as QuizComponentViewQuizConfig)?.answerComponent);
  readonly resultsComponentConfigSignal: Signal<Maybe<DbxInjectionComponentConfig>> = computed(() => (this.viewConfigSignal() as QuizComponentViewPostQuizConfig)?.resultsComponent);

  handleKeyDown(event: KeyboardEvent) {
    const code = event.code;

    switch (code) {
      case 'Enter':
        this.quizStore.startedQuiz$.pipe(first()).subscribe((started) => {
          if (!started) {
            this.quizStore.startQuiz();
          } else {
            this.clickNextQuestion();
          }
        });
        break;
      case 'ArrowLeft':
        this.clickPreviousQuestion();
        break;
      case 'ArrowRight':
        this.clickNextQuestion();
        break;
    }
  }

  clickPreviousQuestion() {
    this.quizStore.goToPreviousQuestion();
  }

  clickNextQuestion() {
    this.quizStore.goToNextQuestion();
  }
}
