import { Component, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxContentPitDirective } from '@dereekb/dbx-web';
import { type Quiz, QuizComponent, QuizPreQuizIntroComponent, QuizQuestionTextComponent, QuizAnswerNumberComponent, QuizAnswerMultipleChoiceComponent, quizAgreementPrompt, quizFrequencyPrompt } from '@dereekb/dbx-form/quiz';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocExtensionQuizExampleResultComponent } from '../component/quiz.example.result.component';
import { JsonPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';

@Component({
  templateUrl: './quiz.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxContentPitDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, QuizComponent, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionQuizComponent {
  readonly quizComponentRef = viewChild(QuizComponent);

  readonly storeStateSignal = toSignal(
    toObservable(this.quizComponentRef).pipe(
      switchMap((quizComponent) => {
        if (!quizComponent) return of(null);
        const store = quizComponent.quizStore;
        return combineLatest([store.startedQuiz$, store.submittedQuiz$, store.questionIndex$, store.answers$, store.completedQuestions$, store.unansweredQuestions$, store.lockQuizNavigation$]).pipe(
          map(([startedQuiz, submittedQuiz, questionIndex, answers, completedQuestions, unansweredQuestions, lockQuizNavigation]) => ({
            startedQuiz,
            submittedQuiz,
            questionIndex,
            answers: Object.fromEntries(answers),
            completedQuestions,
            unansweredQuestions,
            lockQuizNavigation
          }))
        );
      })
    )
  );

  readonly quiz: Quiz = {
    id: 'demo-quiz',
    titleDetails: {
      title: 'Demo Quiz',
      subtitle: 'A sample quiz demonstrating @dereekb/dbx-form/quiz',
      description: 'This quiz demonstrates the different question types and scoring.'
    },
    preQuizComponentConfig: {
      componentClass: QuizPreQuizIntroComponent,
      init: (_instance: QuizPreQuizIntroComponent) => {
        // no-op: pre-quiz intro requires no initialization
      }
    } as DbxInjectionComponentConfig<QuizPreQuizIntroComponent>,
    resultsComponentConfig: {
      componentClass: DocExtensionQuizExampleResultComponent
    },
    questions: [
      {
        id: 'q1',
        questionComponentConfig: {
          componentClass: QuizQuestionTextComponent,
          init: (instance: QuizQuestionTextComponent) => {
            instance.config.set({
              text: 'What is the primary purpose of Angular signals?'
            });
          }
        } as DbxInjectionComponentConfig<QuizQuestionTextComponent>,
        answerComponentConfig: {
          componentClass: QuizAnswerMultipleChoiceComponent,
          init: (instance: QuizAnswerMultipleChoiceComponent) => {
            instance.config.set({
              answerText: ['To replace RxJS entirely', 'To provide fine-grained reactivity for synchronous state', 'To handle HTTP requests', 'To manage routing'],
              correctAnswerIndex: 1
            });
          }
        } as DbxInjectionComponentConfig<QuizAnswerMultipleChoiceComponent>
      },
      {
        id: 'q2',
        questionComponentConfig: {
          componentClass: QuizQuestionTextComponent,
          init: (instance: QuizQuestionTextComponent) => {
            instance.config.set(quizAgreementPrompt('I am comfortable using Angular dependency injection.'));
          }
        } as DbxInjectionComponentConfig<QuizQuestionTextComponent>,
        answerComponentConfig: {
          componentClass: QuizAnswerNumberComponent
        }
      },
      {
        id: 'q3',
        questionComponentConfig: {
          componentClass: QuizQuestionTextComponent,
          init: (instance: QuizQuestionTextComponent) => {
            instance.config.set(quizFrequencyPrompt('I write unit tests for my Angular components.'));
          }
        } as DbxInjectionComponentConfig<QuizQuestionTextComponent>,
        answerComponentConfig: {
          componentClass: QuizAnswerNumberComponent
        }
      },
      {
        id: 'q4',
        questionComponentConfig: {
          componentClass: QuizQuestionTextComponent,
          init: (instance: QuizQuestionTextComponent) => {
            instance.config.set({
              text: 'Which RxJS operator is best for switching to a new inner observable, canceling the previous one?'
            });
          }
        } as DbxInjectionComponentConfig<QuizQuestionTextComponent>,
        answerComponentConfig: {
          componentClass: QuizAnswerMultipleChoiceComponent,
          init: (instance: QuizAnswerMultipleChoiceComponent) => {
            instance.config.set({
              answerText: ['mergeMap', 'concatMap', 'switchMap', 'exhaustMap'],
              correctAnswerIndex: 2
            });
          }
        } as DbxInjectionComponentConfig<QuizAnswerMultipleChoiceComponent>
      },
      {
        id: 'q5',
        questionComponentConfig: {
          componentClass: QuizQuestionTextComponent,
          init: (instance: QuizQuestionTextComponent) => {
            instance.config.set(quizAgreementPrompt('I understand the difference between standalone and NgModule-based components.'));
          }
        } as DbxInjectionComponentConfig<QuizQuestionTextComponent>,
        answerComponentConfig: {
          componentClass: QuizAnswerNumberComponent
        }
      }
    ]
  };
}
