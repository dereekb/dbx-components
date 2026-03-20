import { Injectable } from '@angular/core';
import { type QuestionIndex, type Quiz, type QuizAnswer, type QuizQuestion, type QuizQuestionId, type QuizQuestionIdIndexPair, type QuizQuestionWithIndex } from './quiz';
import { ComponentStore } from '@ngrx/component-store';
import { type ArrayOrValue, asArray, type Configurable, type Maybe } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, map, type Observable, of, shareReplay, switchMap } from 'rxjs';
import { asObservable, type ObservableOrValue } from '@dereekb/rxjs';

/**
 * Internal state shape managed by QuizStore.
 */
export interface QuizStoreState {
  /**
   * Map of questions, keyed by id.
   *
   * Unset if the quiz is not yet set.
   */
  readonly questionMap?: Maybe<ReadonlyMap<QuizQuestionId, QuizQuestion>>;
  /**
   * Started quiz
   */
  readonly startedQuiz: boolean;
  /**
   * Questions that have been answered, sorted by index.
   */
  readonly completedQuestions: QuizQuestionIdIndexPair[];
  /**
   * Questions that are remaining to be answered, sorted by index.
   */
  readonly unansweredQuestions: QuizQuestionIdIndexPair[];
  /**
   * Map of current answers.
   */
  readonly answers: ReadonlyMap<QuizQuestionId, QuizAnswer>;
  /**
   * The current index that corresponds with the selected question.
   *
   * If null, defaults to the first question.
   *
   * If greater than the total number of questions, then the quiz is considered complete.
   */
  readonly questionIndex?: Maybe<QuestionIndex>;
  /**
   * If true, the quiz is locked from navigation.
   *
   * Typically used while submitting the quiz.
   */
  readonly lockQuizNavigation?: boolean;
  /**
   * If true, the quiz has been marked as submitted.
   */
  readonly submittedQuiz?: boolean;
  /**
   * The current/active quiz.
   */
  readonly quiz?: Maybe<Quiz>;
  /**
   * If true, allows going back to visit previous questions.
   */
  readonly allowVisitingPreviousQuestion: boolean;
  /**
   * If true, automatically advances to the next question when an answer is set.
   */
  readonly autoAdvanceToNextQuestion: boolean;
  /**
   * Whether or not skipping questions is allowed.
   *
   * Defaults to false.
   */
  readonly allowSkipQuestion: boolean;
}

/**
 * Lookup input for retrieving an answer by question id, index, or the current question.
 * Provide exactly one of `id`, `index`, or `currentIndex`.
 */
export interface QuizStoreAnswerLookupInput extends Partial<QuizQuestionIdIndexPair> {
  readonly currentIndex?: boolean;
}

/**
 * NgRx ComponentStore that manages quiz lifecycle: question navigation, answer tracking,
 * submission state, and navigation locking.
 *
 * Provided at the component level by `QuizComponent`.
 *
 * @example
 * ```ts
 * // Access from a child component via DI:
 * readonly quizStore = inject(QuizStore);
 * this.quizStore.startQuiz();
 * this.quizStore.updateAnswerForCurrentQuestion(5);
 * ```
 */
@Injectable()
export class QuizStore extends ComponentStore<QuizStoreState> {
  constructor() {
    super({
      quiz: undefined,
      startedQuiz: false,
      submittedQuiz: false,
      answers: new Map(),
      questionIndex: undefined,
      unansweredQuestions: [],
      completedQuestions: [],
      questionMap: undefined,
      autoAdvanceToNextQuestion: true,
      allowVisitingPreviousQuestion: true,
      allowSkipQuestion: false
    });
  }

  readonly quiz$ = this.select((state) => state.quiz);
  readonly titleDetails$ = this.quiz$.pipe(map((quiz) => quiz?.titleDetails));
  readonly questions$ = this.quiz$.pipe(map((quiz) => quiz?.questions ?? []));
  readonly startedQuiz$ = this.select((state) => state.startedQuiz);
  readonly lockQuizNavigation$ = this.select((state) => state.lockQuizNavigation);
  readonly submittedQuiz$ = this.select((state) => state.submittedQuiz);
  readonly answers$ = this.select((state) => state.answers);
  readonly questionIndex$ = this.select((state) => state.questionIndex ?? 0);
  readonly completedQuestions$ = this.select((state) => state.completedQuestions);
  readonly unansweredQuestions$ = this.select((state) => state.unansweredQuestions);
  readonly hasAnswerForEachQuestion$ = this.select((state) => state.unansweredQuestions.length === 0);
  readonly isAtEndOfQuestions$ = this.select((state) => (state.questionIndex ?? 0) >= (state.quiz?.questions.length ?? 0));

  readonly canGoToPreviousQuestion$ = this.select((state) => !state.lockQuizNavigation && state.allowVisitingPreviousQuestion && state.questionIndex != null && state.questionIndex > 0);
  readonly canGoToNextQuestion$ = this.select((state) => {
    const newQuestionIndex = computeAdvanceIndexOnState(state, 1);
    return !state.lockQuizNavigation && state.questionIndex != null && newQuestionIndex != null && newQuestionIndex > state.questionIndex;
  });

  readonly currentQuestion$: Observable<Maybe<QuizQuestionWithIndex>> = combineLatest([this.questions$, this.questionIndex$]).pipe(
    map(([questions, questionIndex]) => {
      const question = questions[questionIndex];
      let result: Maybe<QuizQuestionWithIndex>;

      if (question) {
        result = {
          ...question,
          index: questionIndex
        };
      }

      return result;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Returns a reactive observable of the answer for a given question, looked up by id, index, or the current question.
   *
   * @param lookupInput - Lookup criteria specifying which question's answer to retrieve
   * @returns An observable that emits the current answer for the specified question, or undefined if not answered
   *
   * @example
   * ```ts
   * // By current question:
   * store.answerForQuestion({ currentIndex: true }).subscribe(answer => console.log(answer));
   * // By question id:
   * store.answerForQuestion({ id: 'q1' }).subscribe(answer => console.log(answer));
   * ```
   *
   * @param lookupInput - Lookup criteria specifying which question's answer to retrieve
   */
  answerForQuestion(lookupInput: ObservableOrValue<QuizStoreAnswerLookupInput>): Observable<Maybe<QuizAnswer>> {
    return asObservable(lookupInput).pipe(
      switchMap((lookup) => {
        const { id, index, currentIndex } = lookup;
        let result: Observable<Maybe<QuizAnswer>>;

        if (currentIndex) {
          result = this.currentQuestion$.pipe(switchMap((question) => this.answerForQuestion({ index: question?.index })));
        } else if (id != null) {
          result = this.answers$.pipe(map((answers) => answers.get(id)));
        } else if (index != null) {
          result = this.questions$.pipe(
            switchMap((questions) => {
              const question = questions[index];
              let result: Observable<Maybe<QuizAnswer>>;

              if (question) {
                result = this.answerForQuestion({ id: question.id });
              } else {
                result = of(undefined);
              }

              return result;
            })
          );
        } else {
          result = of(undefined);
        }

        return result;
      }),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  readonly startQuiz = this.updater((state) => startQuizOnState(state));
  readonly setQuiz = this.updater((state, quiz: Maybe<Quiz>) => setQuizOnState(state, quiz));

  /**
   * Resets the quiz entirely, back to the pre-quiz state.
   */
  readonly resetQuiz = this.updater((state) => resetQuizOnState(state));

  /**
   * Restarts the quiz to the first question.
   */
  readonly restartQuizToFirstQuestion = this.updater((state) => restartQuizToFirstQuestionOnState(state));

  readonly setAnswers = this.updater((state, answers: Maybe<QuizAnswer[]>) => setAnswersOnState(state, answers));
  readonly updateAnswers = this.updater((state, answers: Maybe<QuizAnswer[]>) => updateAnswersOnState(state, answers));
  readonly updateAnswerForCurrentQuestion = this.updater((state, answerData: unknown) => updateAnswerForCurrentQuestionOnState(state, answerData));
  readonly setQuestionIndex = this.updater((state, questionIndex: QuestionIndex) => ({ ...state, questionIndex }));
  readonly setAutoAdvanceToNextQuestion = this.updater((state, autoAdvanceToNextQuestion: boolean) => ({ ...state, autoAdvanceToNextQuestion }));
  readonly setAllowSkipQuestion = this.updater((state, allowSkipQuestion: boolean) => ({ ...state, allowSkipQuestion }));
  readonly setAllowVisitingPreviousQuestion = this.updater((state, allowVisitingPreviousQuestion: boolean) => ({ ...state, allowVisitingPreviousQuestion }));

  readonly goToNextQuestion = this.updater((state) => advanceQuestionOnState(state, 1));
  readonly goToPreviousQuestion = this.updater((state) => advanceQuestionOnState(state, -1));

  readonly setLockQuizNavigation = this.updater((state, lockQuizNavigation: boolean) => ({ ...state, lockQuizNavigation }));
  readonly setSubmittedQuiz = this.updater((state, submittedQuiz: boolean) => ({ ...state, submittedQuiz }));
}

function computeAdvanceIndexOnState(state: QuizStoreState, advancement: number): Maybe<QuestionIndex> {
  const { questionIndex, allowSkipQuestion, unansweredQuestions, lockQuizNavigation } = state;
  const maxQuestionIndex = state.quiz?.questions.length;

  let newQuestionIndex: Maybe<QuestionIndex>;

  if (maxQuestionIndex != null && questionIndex != null && !lockQuizNavigation) {
    let maxAllowedIndex = maxQuestionIndex;

    if (!allowSkipQuestion) {
      maxAllowedIndex = unansweredQuestions[0]?.index ?? maxQuestionIndex;
    }

    newQuestionIndex = Math.max(0, Math.min(maxAllowedIndex, questionIndex + advancement));
  }

  return newQuestionIndex;
}

function advanceQuestionOnState(state: QuizStoreState, advancement: number): QuizStoreState {
  const newQuestionIndex = computeAdvanceIndexOnState(state, advancement);

  let nextState: QuizStoreState = state;

  if (newQuestionIndex != null) {
    nextState = {
      ...state,
      questionIndex: newQuestionIndex
    };
  }

  return nextState;
}

function startQuizOnState(state: QuizStoreState): QuizStoreState {
  const { startedQuiz } = state;
  let nextState: QuizStoreState = state;

  if (!startedQuiz) {
    nextState = {
      ...state,
      startedQuiz: true,
      submittedQuiz: false,
      lockQuizNavigation: false,
      questionIndex: 0
    };
  }

  return nextState;
}

function resetQuizOnState(state: QuizStoreState): QuizStoreState {
  return {
    ...restartQuizToFirstQuestionOnState(state),
    startedQuiz: false
  };
}

function restartQuizToFirstQuestionOnState(state: QuizStoreState): QuizStoreState {
  return setAnswersOnState(
    startQuizOnState({
      ...state,
      startedQuiz: false
    }),
    []
  );
}

function setQuizOnState(state: QuizStoreState, quiz?: Maybe<Quiz>): QuizStoreState {
  let questionMap: Maybe<ReadonlyMap<QuizQuestionId, QuizQuestion>> = undefined;
  const currentAnswers = [...state.answers.values()];

  if (quiz?.questions) {
    questionMap = new Map(quiz.questions.map((question) => [question.id, question]));
  }

  return setAnswersOnState({ ...state, quiz, questionMap }, currentAnswers);
}

function setAnswersOnState(state: QuizStoreState, newAnswers: Maybe<ArrayOrValue<QuizAnswer>>): QuizStoreState {
  return updateAnswersOnState(
    {
      ...state,
      answers: new Map()
    },
    newAnswers
  );
}

function updateAnswerForCurrentQuestionOnState(state: QuizStoreState, answerData: unknown): QuizStoreState {
  const { questionIndex } = state;
  let nextState: Configurable<QuizStoreState> = state;

  if (questionIndex != null) {
    const currentQuestion = state.quiz?.questions[questionIndex];

    if (currentQuestion) {
      const answer: QuizAnswer = {
        id: currentQuestion.id,
        data: answerData
      };

      nextState = updateAnswersOnState(state, [answer]);

      if (state.autoAdvanceToNextQuestion) {
        nextState.questionIndex = questionIndex + 1;
      }
    }
  }

  return nextState as QuizStoreState;
}

function updateAnswersOnState(state: QuizStoreState, inputAnswers: Maybe<ArrayOrValue<QuizAnswer>>): QuizStoreState {
  const { quiz, answers: currentAnswers } = state;

  const answers = new Map(currentAnswers);

  asArray(inputAnswers).forEach((answer) => {
    answers.set(answer.id, answer);
  });

  const completedQuestions: QuizQuestionIdIndexPair[] = [];
  const unansweredQuestions: QuizQuestionIdIndexPair[] = [];

  if (quiz?.questions) {
    quiz.questions.forEach((question, index) => {
      if (answers.has(question.id)) {
        completedQuestions.push({ id: question.id, index });
      } else {
        unansweredQuestions.push({ id: question.id, index });
      }
    });
  }

  return { ...state, unansweredQuestions, completedQuestions, answers };
}
