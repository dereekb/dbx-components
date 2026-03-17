import { Component, computed, inject } from '@angular/core';
import { loadingStateFromObs, WorkUsingContext } from '@dereekb/rxjs';
import { DbxQuizPostQuizComponent, QuizStore, QuizAnswerMultipleChoiceComponent, QuizAnswerNumberComponent, DbxQuizScoreComponent, type DbxQuizScoreInput, type QuizAnswer } from '@dereekb/dbx-form/quiz';
import { delay, first, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { Maybe } from '@dereekb/util';
import { type MultipleChoiceAnswer } from '@dereekb/dbx-form/quiz';

@Component({
  template: `
    <dbx-quiz-post-quiz [handleSubmitQuiz]="handleSubmitQuiz">
      <div presubmit>
        <p>The quiz is now complete. Submit to see your score.</p>
      </div>
      <div postsubmit>
        <dbx-quiz-score [input]="scoreSignal()"></dbx-quiz-score>
      </div>
    </dbx-quiz-post-quiz>
  `,
  imports: [DbxQuizPostQuizComponent, DbxQuizScoreComponent],
  standalone: true
})
export class DocExtensionQuizExampleResultComponent {
  readonly quizStore = inject(QuizStore);
  readonly quizQuestionsSignal = toSignal(this.quizStore.questions$);
  readonly quizAnswersSignal = toSignal(this.quizStore.answers$);

  readonly scoreSignal = computed(() => {
    const answers = this.quizAnswersSignal() ?? new Map();
    const questions = this.quizQuestionsSignal() ?? [];

    const multipleChoiceQuestionKeys = questions.filter((x) => x.answerComponentConfig?.componentClass === QuizAnswerMultipleChoiceComponent).map((x) => x.id);
    const numberQuestionKeys = questions.filter((x) => x.answerComponentConfig?.componentClass === QuizAnswerNumberComponent).map((x) => x.id);

    const maxMultipleChoiceScore = multipleChoiceQuestionKeys.length;
    const multipleChoiceScore = multipleChoiceQuestionKeys.reduce((acc, key) => {
      const answer = answers?.get(key) as Maybe<QuizAnswer<MultipleChoiceAnswer>>;
      return acc + (answer?.data?.isCorrectAnswer ? 1 : 0);
    }, 0);

    const maxNumberScore = numberQuestionKeys.length * 5;
    const numberScore = numberQuestionKeys.reduce((acc, key) => {
      const answer = answers?.get(key) as Maybe<QuizAnswer<number>>;
      return acc + (answer?.data || 0);
    }, 0);

    const maxScore = maxNumberScore + maxMultipleChoiceScore;
    const score = numberScore + multipleChoiceScore;
    const percentage = maxScore > 0 ? score / maxScore : 0;

    let feedbackText: string;
    let subtitle: Maybe<string>;

    if (percentage >= 0.8) {
      feedbackText = 'Excellent! You demonstrated strong understanding.';
      subtitle = 'Great work!';
    } else if (percentage >= 0.6) {
      feedbackText = 'Good effort. Some areas could use review.';
      subtitle = undefined;
    } else {
      feedbackText = 'Consider reviewing the material and trying again.';
      subtitle = undefined;
    }

    const scoreInput: DbxQuizScoreInput = {
      showRetakeButton: percentage < 0.8,
      feedbackText,
      score,
      maxScore,
      subtitle
    };

    return scoreInput;
  });

  readonly handleSubmitQuiz: WorkUsingContext<void> = (_, context) => {
    context.startWorkingWithLoadingStateObservable(loadingStateFromObs(of({}).pipe(first(), delay(500))));
  };
}
