import { Component, inject, input } from '@angular/core';
import { DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { QuizStore } from '../store/quiz.store';
import { type Work } from '@dereekb/rxjs';

/**
 * Button component that restarts the quiz to the first question.
 *
 * @usage
 * ```html
 * <dbx-quiz-reset-button buttonText="Try Again"></dbx-quiz-reset-button>
 * ```
 */
@Component({
  selector: 'dbx-quiz-reset-button',
  template: `
    <div class="dbx-quiz-reset-button">
      <div dbxAction dbxActionLogger dbxActionValue dbxActionSnackbarError [dbxActionHandler]="handleResetQuizButton">
        <dbx-button [raised]="true" [text]="buttonText()" dbxActionButton></dbx-button>
      </div>
    </div>
  `,
  imports: [DbxButtonModule, DbxActionModule],
  standalone: true
})
export class DbxQuizResetButtonComponent {
  readonly quizStore = inject(QuizStore);

  readonly buttonText = input<string>(`Restart Quiz`);

  readonly handleResetQuizButton: Work<void> = (_, context) => {
    this.quizStore.restartQuizToFirstQuestion();
    context.success();
  };
}
