import { Component, computed, inject, model } from '@angular/core';
import { DbxButtonModule, DbxWindowKeyDownListenerDirective } from '@dereekb/dbx-web';
import { QuizQuestionAccessor } from '../store/quiz.accessor';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Maybe, range, type RangeInput } from '@dereekb/util';

/**
 * Named preset for common number ranges.
 */
export type QuizAnswerNumberComponentPreset = 'oneToFive';

/**
 * Configuration for the number answer component. Provide a preset, explicit range, or arbitrary numbers.
 */
export interface QuizAnswerNumberComponentConfig {
  /**
   * Uses a preset to compute the range/numbers.
   */
  readonly preset?: QuizAnswerNumberComponentPreset;
  /**
   * Range configuration
   */
  readonly range?: RangeInput;
  /**
   * Arbitrary array of numbers
   */
  readonly numbers?: number[];
}

interface QuizAnswerNumberChoice {
  readonly number: number;
  readonly selected?: boolean;
}

/**
 * Answer component that displays configurable number buttons.
 *
 * @usage
 * Used as an answer component in a QuizQuestion's answerComponentConfig.
 * Defaults to 1-5 range if no config is provided.
 *
 * ```typescript
 * answerComponentConfig: {
 *   componentClass: QuizAnswerNumberComponent,
 *   init: (instance: QuizAnswerNumberComponent) => {
 *     instance.config.set({ range: { start: 1, end: 11 } });
 *   }
 * }
 * ```
 */
@Component({
  templateUrl: './quiz.answer.number.component.html',
  imports: [DbxButtonModule, DbxWindowKeyDownListenerDirective],
  standalone: true
})
export class QuizAnswerNumberComponent {
  readonly questionAccessor = inject<QuizQuestionAccessor<number>>(QuizQuestionAccessor);

  readonly config = model<Maybe<QuizAnswerNumberComponentConfig>>();

  readonly currentAnswerSignal = toSignal(this.questionAccessor.answer$);
  readonly currentAnswerValueSignal = computed(() => this.currentAnswerSignal()?.data);

  readonly choicesSignal = computed(() => {
    const { range: inputRange, numbers: inputNumbers, preset } = this.config() ?? { preset: 'oneToFive' };
    const currentAnswer = this.currentAnswerValueSignal();

    let useRange: Maybe<RangeInput>;
    let useNumbers: Maybe<number[]>;

    if (preset) {
      switch (preset) {
        case 'oneToFive':
        default:
          useRange = { start: 1, end: 6 };
          break;
      }
    } else if (inputRange) {
      useRange = inputRange;
    } else if (inputNumbers) {
      useNumbers = inputNumbers;
    }

    let numbers: number[];

    if (useRange) {
      numbers = range(useRange);
    } else if (useNumbers) {
      numbers = useNumbers ?? [];
    } else {
      numbers = [];
    }

    const choices: QuizAnswerNumberChoice[] = numbers.map((number) => {
      return {
        number,
        selected: currentAnswer === number
      };
    });

    return choices;
  });

  readonly relevantKeysSignal = computed<string[]>(() => {
    const choices = this.choicesSignal();
    return choices.map((choice) => choice.number.toString());
  });

  clickedAnswer(answer: number) {
    this.questionAccessor.setAnswer(answer);
  }

  handleKeyDown(event: KeyboardEvent) {
    const number = Number(event.key);
    if (!isNaN(number)) {
      this.clickedAnswer(number);
    }
  }
}
