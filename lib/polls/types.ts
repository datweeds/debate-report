// Society Polls: shared types (server and browser). Ported from poll.voter.care.

export const QUESTION_TYPES = ['single_choice', 'multi_choice', 'ranked', 'rcv', 'star', 'yes_no', 'scale', 'word'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];

export const QUESTION_LABELS: Record<QuestionType, string> = {
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
  ranked: 'Ranking',
  rcv: 'Ranked-choice vote (instant runoff)',
  star: 'Star rating',
  yes_no: 'Yes / No',
  scale: 'Scale',
  word: 'One word (word cloud)',
};

export type PollOption = { id: string; text: string; image?: string; moreInfoLink?: string };

export type Question = {
  id: string;
  text: string;
  type: QuestionType;
  options: PollOption[];
  correct?: string[];          // quiz: the correct option id(s) ('yes'/'no' for yes_no)
  settings: {
    randomOrder?: boolean;
    allowComments?: boolean;
    commentsPublic?: boolean;
    maxChoices?: number;       // multi_choice: at most this many (0/undefined = any)
    scaleMin?: number;
    scaleMax?: number;
    scaleMinLabel?: string;
    scaleMaxLabel?: string;
  };
};

export type PollPayload = {
  title: string;
  description?: string;
  headerImage?: string;
  questions: Question[];
};

// One answer. single_choice / yes_no: option id ('yes'/'no'); multi_choice:
// option ids; ranked / rcv: option ids in order of preference; star: option
// id → 1-5; scale: number; word: text.
export type Answer = {
  questionId: string;
  value: string | string[] | number | Record<string, number>;
  comment?: string;
};

export type PollSettings = {
  status: 'draft' | 'open' | 'closed';
  close_mode: 'manual' | 'fixed';
  closes_at: string | null;
  question_order: 'all_at_once' | 'sequential';
  questions_revealed: number;
  result_visibility: 'live' | 'after_close' | 'never';
  ballot_mode: 'secret' | 'named';
  allow_revote: boolean;
  is_quiz: boolean;
  allow_codes: boolean;
  members_may_vote: boolean;
  formal: boolean;                          // a formal ballot (lib/polls/formal.ts)
  quorum_pct: number | null;
  majority: 'simple' | 'two_thirds' | 'three_quarters';
};

export const YES_NO: PollOption[] = [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }];
export const optionsOf = (q: Question): PollOption[] => q.type === 'yes_no' ? YES_NO : q.options;
export const hasOptions = (t: QuestionType) => !['yes_no', 'scale', 'word'].includes(t);
