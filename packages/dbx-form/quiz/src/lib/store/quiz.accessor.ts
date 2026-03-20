import { type Maybe } from '@dereekb/util';
import { type Observable, type Subscription } from 'rxjs';
import { type QuizQuestion, type QuizAnswer, type Quiz } from './quiz';
import { type Provider } from '@angular/core';
import { QuizStore } from './quiz.store';

/**
 * Abstract accessor injected into answer/question child components to read the current question
 * and write answers back to the QuizStore without coupling to it directly.
 *
 * Use `provideCurrentQuestionQuizQuestionAccessor()` to bind this to the store's current question.
 */
export abstract class QuizQuestionAccessor<T = unknown> {
  /**
   * The active quiz definition.
   */
  abstract readonly quiz$: Observable<Maybe<Quiz>>;

  /**
   * The question this accessor is bound to.
   */
  abstract readonly question$: Observable<Maybe<QuizQuestion>>;

  /**
   * The current answer for this question, or undefined if unanswered.
   */
  abstract readonly answer$: Observable<Maybe<QuizAnswer<T>>>;

  /**
   * Submits an answer value for this question.
   */
  abstract setAnswer(answer: T): void;

  /**
   * Binds an observable source whose emissions are forwarded as answer updates.
   */
  abstract setAnswerSource(answer: Observable<T>): Subscription;
}

/**
 * Provides QuizQuestionAccessor bound to the current question in QuizStore.
 *
 * @returns An Angular provider that binds QuizQuestionAccessor to the current quiz question
 *
 * @usage
 * ```typescript
 * @Component({
 *   providers: [QuizStore, provideCurrentQuestionQuizQuestionAccessor()]
 * })
 * ```
 */
export function provideCurrentQuestionQuizQuestionAccessor<T = unknown>(): Provider {
  return {
    provide: QuizQuestionAccessor,
    useFactory: (quizStore: QuizStore) => {
      return {
        quiz$: quizStore.quiz$,
        question$: quizStore.currentQuestion$,
        answer$: quizStore.answerForQuestion({ currentIndex: true }),
        setAnswer: (answer: T) => quizStore.updateAnswerForCurrentQuestion(answer),
        setAnswerSource: (answer: Observable<T>) => quizStore.updateAnswerForCurrentQuestion(answer)
      };
    },
    deps: [QuizStore]
  };
}
