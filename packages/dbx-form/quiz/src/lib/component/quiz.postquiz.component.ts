import { Component, computed, inject, input } from '@angular/core';
import { DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { QuizStore } from '../store/quiz.store';
import { type Work } from '@dereekb/rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type DbxActionSuccessHandlerFunction } from '@dereekb/dbx-core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Submission lifecycle state within the post-quiz view.
 */
export type DbxQuizPostQuizState = 'presubmit' | 'postsubmit';

/**
 * Post-quiz component that handles quiz submission and displays pre/post submit content.
 *
 * @usage
 * Use as a wrapper in your results component template:
 *
 * ```html
 * <dbx-quiz-post-quiz [handleSubmitQuiz]="handleSubmitQuiz">
 *   <div presubmit>Pre-submit content...</div>
 *   <div postsubmit>Post-submit content (scores, etc.)...</div>
 * </dbx-quiz-post-quiz>
 * ```
 */
@Component({
  selector: 'dbx-quiz-post-quiz',
  templateUrl: './quiz.postquiz.component.html',
  imports: [DbxButtonModule, DbxActionModule, NgTemplateOutlet],
  standalone: true
})
export class DbxQuizPostQuizComponent {
  readonly quizStore = inject(QuizStore);

  readonly quizSubmittedSignal = toSignal(this.quizStore.submittedQuiz$);

  readonly stateSignal = computed(() => {
    const submitted = this.quizSubmittedSignal();

    if (submitted) {
      return 'postsubmit';
    } else {
      return 'presubmit';
    }
  });

  readonly handleSubmitQuiz = input<Work<void>>();

  readonly handleSubmitQuizButton: Work<void> = (_, context) => {
    this.quizStore.setLockQuizNavigation(true);
    const handler = this.handleSubmitQuiz();

    if (handler) {
      return handler(_, context);
    } else {
      context.reject();
    }
  };

  readonly handleSubmitQuizSuccess: DbxActionSuccessHandlerFunction = () => {
    this.quizStore.setSubmittedQuiz(true);
  };
}
