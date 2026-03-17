import { Component, computed, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxQuizResetButtonComponent } from './quiz.reset.button.component';

/**
 * Input data for rendering the quiz score display.
 */
export interface DbxQuizScoreInput {
  /**
   * Whether to show the retake/reset button.
   */
  readonly showRetakeButton?: boolean;
  /**
   * Feedback text to display.
   */
  readonly feedbackText: string;
  /**
   * Optional subtitle text.
   */
  readonly subtitle?: Maybe<string>;
  /**
   * The score achieved.
   */
  readonly score: number;
  /**
   * The maximum possible score.
   */
  readonly maxScore: number;
}

/**
 * Generic quiz score display component.
 *
 * @usage
 * ```html
 * <dbx-quiz-score [input]="scoreInput"></dbx-quiz-score>
 * ```
 */
@Component({
  selector: 'dbx-quiz-score',
  template: `
    <div class="dbx-quiz-score">
      <h3 class="dbx-quiz-score-score">{{ scoreSignal() }}/{{ maxScoreSignal() }}</h3>
      <p class="dbx-quiz-score-text">{{ feedbackTextSignal() }}</p>
      @if (subtitleSignal()) {
        <p class="dbx-quiz-score-subtitle">{{ subtitleSignal() }}</p>
      }
      @if (showRetakeButtonSignal()) {
        <dbx-quiz-reset-button buttonText="Retake Quiz"></dbx-quiz-reset-button>
      }
    </div>
  `,
  imports: [DbxQuizResetButtonComponent],
  standalone: true
})
export class DbxQuizScoreComponent {
  readonly input = input<Maybe<DbxQuizScoreInput>>();

  readonly scoreSignal = computed(() => this.input()?.score);
  readonly maxScoreSignal = computed(() => this.input()?.maxScore);
  readonly feedbackTextSignal = computed(() => this.input()?.feedbackText ?? '');
  readonly subtitleSignal = computed(() => this.input()?.subtitle);
  readonly showRetakeButtonSignal = computed(() => this.input()?.showRetakeButton);
}
