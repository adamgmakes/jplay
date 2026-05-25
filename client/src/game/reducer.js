export const initialState = {
  gameData: null,
  mode: 'board',
  currentRound: 'jeopardy',
  score: 0,
  coryatScore: 0,
  cluesCorrect: 0,
  cluesIncorrect: 0,
  cluesTimedOut: 0,
  cluesAcceptedOverride: 0,
  dailyDoublesSeen: 0,
  dailyDoublesCorrect: 0,
  clueQueue: [],
  revealedClues: new Set(),
  categoryResults: {}, // { cat: { correct, incorrect } }
  activeClue: null,
  phase: 'board', // board | clue_active | answer_input | answer_reveal | dd_wager | fj_category | fj_wager | fj_active | fj_reveal | round_end | game_over
  userAnswer: '',
  lastAnswerResult: null,
  wager: 0,
  finalJeopardyWager: 0,
  finalJeopardyCorrect: null,
  sessionId: null,
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clueById(state, id) {
  const { jeopardy, doubleJeopardy } = state.gameData.rounds;
  return (
    jeopardy.clues.find((c) => c.id === id) ||
    doubleJeopardy.clues.find((c) => c.id === id) ||
    null
  );
}

function allCluesInRound(state) {
  const r = state.currentRound === 'jeopardy'
    ? state.gameData.rounds.jeopardy
    : state.gameData.rounds.doubleJeopardy;
  return r.clues.filter((c) => c.text);
}

function roundComplete(state) {
  const clues = allCluesInRound(state);
  return clues.every((c) => state.revealedClues.has(c.id));
}

export function reducer(state, action) {
  switch (action.type) {
    case 'INIT': {
      const { gameData, mode } = action;
      // Random mode: combine J + DJ into a queue
      const all = [
        ...gameData.rounds.jeopardy.clues,
        ...gameData.rounds.doubleJeopardy.clues,
      ].filter((c) => c.text);
      const queue = mode === 'random' ? shuffle(all).map((c) => c.id) : [];
      let phase = 'board';
      let activeClue = null;
      let currentRound = 'jeopardy';
      let wager = 0;
      if (mode === 'random' && queue.length) {
        const firstId = queue[0];
        activeClue = all.find((c) => c.id === firstId) || null;
        if (activeClue) {
          currentRound = activeClue.id.startsWith('clue_DJ') ? 'doubleJeopardy' : 'jeopardy';
          if (activeClue.isDailyDouble) {
            phase = 'dd_wager';
            wager = currentRound === 'jeopardy' ? 1000 : 2000;
          } else {
            phase = 'clue_active';
          }
        }
      }
      return {
        ...initialState,
        gameData,
        mode,
        clueQueue: queue,
        revealedClues: new Set(),
        currentRound,
        activeClue,
        wager,
        phase,
      };
    }

    case 'SELECT_CLUE': {
      const clue = clueById(state, action.id);
      if (!clue || !clue.text) return state;
      if (state.revealedClues.has(clue.id)) return state;
      if (clue.isDailyDouble) {
        return {
          ...state,
          activeClue: clue,
          phase: 'dd_wager',
          wager: Math.min(
            Math.max(state.score, state.currentRound === 'jeopardy' ? 1000 : 2000),
            Math.max(state.score, state.currentRound === 'jeopardy' ? 1000 : 2000)
          ),
        };
      }
      return { ...state, activeClue: clue, phase: 'clue_active' };
    }

    case 'SET_WAGER':
      return { ...state, wager: action.value };

    case 'CONFIRM_DD_WAGER':
      return { ...state, phase: 'clue_active' };

    case 'BUZZ_IN':
      if (state.phase !== 'clue_active') return state;
      return { ...state, phase: 'answer_input' };

    case 'SET_USER_ANSWER':
      return { ...state, userAnswer: action.value };

    case 'SUBMIT_ANSWER': {
      const { correct } = action;
      const clue = state.activeClue;
      if (!clue) return state;
      let scoreDelta = 0;
      let coryatDelta = 0;
      const isDD = clue.isDailyDouble;
      const wagerValue = isDD ? state.wager : clue.value;
      if (correct) {
        scoreDelta = wagerValue;
        coryatDelta = isDD ? 0 : clue.value;
      } else {
        scoreDelta = -wagerValue;
        coryatDelta = 0;
      }
      const cat = clue.category || 'Unknown';
      const cr = state.categoryResults[cat] || { correct: 0, incorrect: 0 };
      return {
        ...state,
        phase: 'answer_reveal',
        score: state.score + scoreDelta,
        coryatScore: state.coryatScore + coryatDelta,
        cluesCorrect: state.cluesCorrect + (correct ? 1 : 0),
        cluesIncorrect: state.cluesIncorrect + (correct ? 0 : 1),
        dailyDoublesSeen: state.dailyDoublesSeen + (isDD ? 1 : 0),
        dailyDoublesCorrect: state.dailyDoublesCorrect + (isDD && correct ? 1 : 0),
        lastAnswerResult: { correct, override: false, delta: scoreDelta },
        categoryResults: {
          ...state.categoryResults,
          [cat]: {
            correct: cr.correct + (correct ? 1 : 0),
            incorrect: cr.incorrect + (correct ? 0 : 1),
          },
        },
      };
    }

    case 'TIMEOUT_ANSWER': {
      const clue = state.activeClue;
      if (!clue) return state;
      return {
        ...state,
        phase: 'answer_reveal',
        cluesTimedOut: state.cluesTimedOut + 1,
        lastAnswerResult: { correct: false, override: false, delta: 0, timedOut: true },
      };
    }

    case 'ACCEPT_ANYWAY': {
      const clue = state.activeClue;
      if (!clue || !state.lastAnswerResult) return state;
      const prev = state.lastAnswerResult;
      // Revert previous delta, then add the correct credit
      const isDD = clue.isDailyDouble;
      const wagerValue = isDD ? state.wager : clue.value;
      const newScore = state.score - prev.delta + wagerValue;
      const coryatGain = isDD ? 0 : clue.value;
      const cat = clue.category || 'Unknown';
      const cr = state.categoryResults[cat] || { correct: 0, incorrect: 0 };
      const wasCorrect = prev.correct;
      return {
        ...state,
        score: newScore,
        coryatScore: state.coryatScore + coryatGain,
        cluesCorrect: state.cluesCorrect + (wasCorrect ? 0 : 1),
        cluesIncorrect: state.cluesIncorrect - (wasCorrect ? 0 : 1) + (prev.timedOut ? 0 : 0),
        cluesTimedOut: state.cluesTimedOut - (prev.timedOut ? 1 : 0),
        cluesAcceptedOverride: state.cluesAcceptedOverride + 1,
        dailyDoublesCorrect: state.dailyDoublesCorrect + (isDD && !wasCorrect ? 1 : 0),
        lastAnswerResult: { ...prev, correct: true, override: true, delta: wagerValue },
        categoryResults: {
          ...state.categoryResults,
          [cat]: {
            correct: cr.correct + (wasCorrect ? 0 : 1),
            incorrect: Math.max(0, cr.incorrect - (wasCorrect ? 0 : 1)),
          },
        },
      };
    }

    case 'NEXT_CLUE': {
      const clue = state.activeClue;
      const revealed = new Set(state.revealedClues);
      if (clue) revealed.add(clue.id);
      let nextState = {
        ...state,
        revealedClues: revealed,
        activeClue: null,
        userAnswer: '',
        lastAnswerResult: null,
        wager: 0,
        phase: 'board',
      };
      // Round transitions
      const tempState = { ...nextState };
      if (tempState.currentRound === 'jeopardy' && roundComplete(tempState)) {
        nextState = { ...nextState, currentRound: 'doubleJeopardy', phase: 'round_end' };
      } else if (
        tempState.currentRound === 'doubleJeopardy' &&
        roundComplete(tempState)
      ) {
        nextState = { ...nextState, phase: 'fj_category' };
      }
      // Random mode auto-advance
      if (state.mode === 'random' && nextState.phase === 'board') {
        const queue = nextState.clueQueue.filter((id) => !revealed.has(id));
        if (queue.length === 0) {
          nextState = { ...nextState, phase: 'fj_category' };
        } else {
          const nextId =
            queue.find((id) => {
              const c = clueById(nextState, id);
              if (!c) return false;
              const round = c.id.startsWith('clue_DJ') ? 'doubleJeopardy' : 'jeopardy';
              return round === nextState.currentRound;
            }) || queue[0];
          const nextClue = clueById(nextState, nextId);
          const round = nextClue.id.startsWith('clue_DJ') ? 'doubleJeopardy' : 'jeopardy';
          nextState = {
            ...nextState,
            currentRound: round,
            activeClue: nextClue,
            phase: nextClue.isDailyDouble ? 'dd_wager' : 'clue_active',
            wager: nextClue.isDailyDouble
              ? Math.max(state.score, round === 'jeopardy' ? 1000 : 2000)
              : 0,
          };
        }
      }
      return nextState;
    }

    case 'ADVANCE_FROM_ROUND_END':
      return { ...state, phase: 'board' };

    case 'SKIP_TO_FJ':
      return { ...state, phase: 'fj_category', activeClue: null, userAnswer: '' };

    case 'BEGIN_FJ_WAGER':
      return { ...state, phase: 'fj_wager' };

    case 'SET_FJ_WAGER':
      return { ...state, finalJeopardyWager: action.value };

    case 'CONFIRM_FJ_WAGER':
      return { ...state, phase: 'fj_active' };

    case 'SUBMIT_FJ_ANSWER': {
      const { correct } = action;
      const delta = correct ? state.finalJeopardyWager : -state.finalJeopardyWager;
      return {
        ...state,
        phase: 'fj_reveal',
        score: state.score + delta,
        finalJeopardyCorrect: correct,
        lastAnswerResult: { correct, override: false, delta, fj: true },
      };
    }

    case 'FJ_ACCEPT_ANYWAY': {
      const prev = state.lastAnswerResult;
      if (!prev) return state;
      const newScore = state.score - prev.delta + state.finalJeopardyWager;
      return {
        ...state,
        score: newScore,
        finalJeopardyCorrect: true,
        cluesAcceptedOverride: state.cluesAcceptedOverride + 1,
        lastAnswerResult: { ...prev, correct: true, override: true, delta: state.finalJeopardyWager },
      };
    }

    case 'FINISH_GAME':
      return { ...state, phase: 'game_over' };

    case 'SET_USER_ANSWER_CLEAR':
      return { ...state, userAnswer: '' };

    default:
      return state;
  }
}
