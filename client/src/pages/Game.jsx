import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchGame } from '../lib/api.js';
import { reducer, initialState } from '../game/reducer.js';
import { checkAnswer } from '../game/answer.js';
import { ding, FinalJeopardyTicker } from '../game/audio.js';
import { speak, cancelSpeak, recognizerSupported, createRecognizer } from '../game/voice.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import Board from '../components/Board.jsx';
import Timer from '../components/Timer.jsx';
import { loadSettings } from '../lib/settings.js';

export default function Game() {
  const { gameId } = useParams();
  const [search] = useSearchParams();
  const mode = search.get('mode') || 'board';
  const nav = useNavigate();
  const { user } = useAuth();

  const [state, dispatch] = useReducer(reducer, initialState);
  const settings = useMemo(() => loadSettings(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const recognizerRef = useRef(null);
  const tickerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGame(gameId)
      .then((data) => {
        if (cancelled) return;
        dispatch({ type: 'INIT', gameData: data, mode });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg =
          e.response?.status === 404
            ? "We couldn't find that game on J! Archive."
            : 'Failed to load game. Try again in a moment.';
        setErr(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [gameId, mode]);

  // Global keyboard: spacebar buzz-in, esc close
  useEffect(() => {
    function onKey(e) {
      const isSpace = e.code === 'Space' || e.key === ' ';
      if (state.phase === 'clue_active' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'BUZZ_IN' });
        cancelSpeak();
        if (mode === 'voice') startListening();
      } else if (state.phase === 'answer_reveal' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'NEXT_CLUE' });
      } else if (state.phase === 'fj_reveal' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'FINISH_GAME' });
      } else if (state.phase === 'round_end' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'ADVANCE_FROM_ROUND_END' });
      }
      if (e.key === 'Escape' && state.phase !== 'board' && state.phase !== 'game_over') {
        cancelSpeak();
        if (state.phase === 'clue_active' || state.phase === 'answer_input') {
          dispatch({ type: 'TIMEOUT_ANSWER' });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Voice mode: speak clue when active
  useEffect(() => {
    if (mode !== 'voice') return;
    if (state.phase === 'clue_active' && state.activeClue) {
      const c = state.activeClue;
      speak(`The category is ${c.category}, for $${c.value}. ${c.text}`);
    }
    if (state.phase === 'fj_active' && state.gameData) {
      const fj = state.gameData.rounds.finalJeopardy;
      speak(fj.clue.text);
    }
    return () => cancelSpeak();
  }, [state.phase, state.activeClue, mode, state.gameData]);

  // FJ ticker
  useEffect(() => {
    if (state.phase === 'fj_active') {
      tickerRef.current = new FinalJeopardyTicker();
      tickerRef.current.start(1000);
      return () => tickerRef.current?.stop();
    }
  }, [state.phase]);

  function startListening() {
    if (!recognizerSupported()) return;
    if (recognizerRef.current) {
      try { recognizerRef.current.stop(); } catch {}
    }
    const rec = createRecognizer({
      onResult: (text) => dispatch({ type: 'SET_USER_ANSWER', value: text }),
      onEnd: (finalText) => {
        setVoiceListening(false);
        if (finalText) submitAnswer(finalText);
      },
    });
    if (!rec) return;
    recognizerRef.current = rec;
    setVoiceListening(true);
    rec.start();
  }

  function submitAnswer(text) {
    const clue = state.activeClue;
    if (!clue) return;
    const correct = checkAnswer(text, clue.answer);
    ding(correct);
    dispatch({ type: 'SUBMIT_ANSWER', correct });
  }

  function submitFJAnswer(text) {
    const fj = state.gameData.rounds.finalJeopardy;
    const correct = checkAnswer(text, fj.clue.answer);
    ding(correct);
    dispatch({ type: 'SUBMIT_FJ_ANSWER', correct });
  }

  // Save session when game_over reached
  useEffect(() => {
    if (state.phase !== 'game_over' || !state.gameData) return;
    saveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  async function saveSession() {
    const contestants = state.gameData.contestants || [];
    const scores = contestants
      .map((c) => c.finalScore)
      .filter((s) => typeof s === 'number');
    let rank = null;
    if (scores.length) {
      rank =
        1 + scores.filter((s) => s > state.score).length;
    }
    if (!user) {
      // anonymous — push to results via in-memory cache fallback
      const localId = `local-${Date.now()}`;
      try {
        sessionStorage.setItem(
          `jplay-session-${localId}`,
          JSON.stringify({ state, gameData: state.gameData, rank })
        );
      } catch {}
      nav(`/results/${localId}`);
      return;
    }
    const payload = {
      user_id: user.id,
      game_id: state.gameData.gameId,
      air_date: state.gameData.airDate,
      show_number: state.gameData.showNumber,
      score: state.score,
      coryat_score: state.coryatScore,
      clues_seen:
        state.cluesCorrect + state.cluesIncorrect + state.cluesTimedOut,
      clues_correct: state.cluesCorrect,
      clues_incorrect: state.cluesIncorrect,
      clues_accepted_override: state.cluesAcceptedOverride,
      daily_doubles_seen: state.dailyDoublesSeen,
      daily_doubles_correct: state.dailyDoublesCorrect,
      final_jeopardy_wager: state.finalJeopardyWager,
      final_jeopardy_correct: state.finalJeopardyCorrect,
      contestant_rank: rank,
      completed: true,
      mode: state.mode,
    };
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      // category stats upsert
      const rows = Object.entries(state.categoryResults).map(([cat, v]) => ({
        user_id: user.id,
        category_name: cat,
        correct: v.correct,
        incorrect: v.incorrect,
      }));
      for (const r of rows) {
        const { data: existing } = await supabase
          .from('category_stats')
          .select('*')
          .eq('user_id', user.id)
          .eq('category_name', r.category_name)
          .maybeSingle();
        if (existing) {
          await supabase
            .from('category_stats')
            .update({
              correct: existing.correct + r.correct,
              incorrect: existing.incorrect + r.incorrect,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('category_stats').insert(r);
        }
      }

      // stash for results page
      try {
        sessionStorage.setItem(
          `jplay-session-${data.id}`,
          JSON.stringify({ state, gameData: state.gameData, rank })
        );
      } catch {}
      nav(`/results/${data.id}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save game. Showing local results.');
      const localId = `local-${Date.now()}`;
      try {
        sessionStorage.setItem(
          `jplay-session-${localId}`,
          JSON.stringify({ state, gameData: state.gameData, rank })
        );
      } catch {}
      nav(`/results/${localId}`);
    }
  }

  if (loading) return <Center><div className="text-jgold font-jeopardy text-3xl">Loading game…</div></Center>;
  if (err) return <Center><div className="text-jred">{err}</div></Center>;
  if (!state.gameData) return null;

  const round =
    state.currentRound === 'jeopardy'
      ? state.gameData.rounds.jeopardy
      : state.gameData.rounds.doubleJeopardy;

  return (
    <div className="min-h-screen bg-jblue flex flex-col">
      <div className="bg-jchrome px-4 py-2 flex justify-between items-center border-b border-jblueDark">
        <div className="font-jeopardy text-jgold text-xl">J! PLAY</div>
        <div className="text-sm text-white/70">
          {state.gameData.airDate
            ? `Aired ${state.gameData.airDate}`
            : `Game #${state.gameData.gameId}`}{' '}
          · {state.currentRound === 'jeopardy' ? 'Jeopardy' : state.currentRound === 'doubleJeopardy' ? 'Double Jeopardy' : 'Final Jeopardy'}
        </div>
        <div className="font-jeopardy text-jgold text-xl">
          {state.score < 0 ? '-' : ''}${Math.abs(state.score).toLocaleString()}
        </div>
      </div>

      <main className="flex-1 p-3 sm:p-6 max-w-6xl w-full mx-auto">
        {(state.phase === 'board' || state.phase === 'round_end') && (
          <>
            <Board
              round={round}
              revealedClues={state.revealedClues}
              onSelectClue={(id) => dispatch({ type: 'SELECT_CLUE', id })}
            />
            <div className="mt-4 flex justify-between text-sm text-white/70">
              <div>Coryat: ${state.coryatScore.toLocaleString()}</div>
              <button
                onClick={() => dispatch({ type: 'SKIP_TO_FJ' })}
                className="underline text-white/60 hover:text-jgold"
              >
                Skip to Final Jeopardy
              </button>
            </div>

            {state.phase === 'round_end' && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="text-center">
                  <div className="font-jeopardy text-5xl text-jgold mb-6">
                    Double Jeopardy!
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'ADVANCE_FROM_ROUND_END' })}
                    className="px-6 py-3 bg-jgold text-jchrome font-bold rounded"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {state.phase === 'dd_wager' && (
          <DailyDoubleWager state={state} dispatch={dispatch} />
        )}

        {(state.phase === 'clue_active' || state.phase === 'answer_input') && (
          <ClueOverlay
            state={state}
            dispatch={dispatch}
            mode={mode}
            voiceListening={voiceListening}
            onStartListening={startListening}
            onSubmit={submitAnswer}
            clueSeconds={settings.clueSeconds}
          />
        )}

        {state.phase === 'answer_reveal' && (
          <AnswerReveal
            state={state}
            dispatch={dispatch}
            autoAdvanceSeconds={settings.autoAdvanceSeconds}
          />
        )}

        {state.phase === 'fj_category' && (
          <FJCategory state={state} dispatch={dispatch} />
        )}

        {state.phase === 'fj_wager' && (
          <FJWager state={state} dispatch={dispatch} />
        )}

        {state.phase === 'fj_active' && (
          <FJActive
            state={state}
            dispatch={dispatch}
            mode={mode}
            onSubmit={submitFJAnswer}
            fjSeconds={settings.fjSeconds}
          />
        )}

        {state.phase === 'fj_reveal' && (
          <FJReveal state={state} dispatch={dispatch} />
        )}
      </main>
    </div>
  );
}

function Center({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-jblue">
      {children}
    </div>
  );
}

function DailyDoubleWager({ state, dispatch }) {
  const max = Math.max(
    state.score,
    state.currentRound === 'jeopardy' ? 1000 : 2000
  );
  return (
    <div className="text-center py-10">
      <div className="font-jeopardy text-6xl text-jgold mb-4 animate-pulse">
        DAILY DOUBLE!
      </div>
      <div className="text-white/70 mb-6">
        Your score: ${state.score.toLocaleString()} · Max wager: ${max.toLocaleString()}
      </div>
      <input
        type="number"
        min={5}
        max={max}
        value={state.wager}
        onChange={(e) =>
          dispatch({
            type: 'SET_WAGER',
            value: Math.max(5, Math.min(max, parseInt(e.target.value || 0, 10))),
          })
        }
        className="text-4xl bg-jblueDeep border border-jgold text-jgold text-center rounded p-3 w-64 font-jeopardy"
      />
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_WAGER', value: max })}
          className="px-4 py-2 rounded bg-jblueDark hover:bg-jblue"
        >
          True Daily Double
        </button>
        <button
          onClick={() => dispatch({ type: 'CONFIRM_DD_WAGER' })}
          className="px-6 py-2 rounded bg-jgold text-jchrome font-bold"
        >
          Wager ${state.wager}
        </button>
      </div>
    </div>
  );
}

function ClueOverlay({ state, dispatch, mode, voiceListening, onStartListening, onSubmit, clueSeconds }) {
  const c = state.activeClue;
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (state.phase === 'answer_input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.phase]);

  useEffect(() => {
    setInput(state.userAnswer || '');
  }, [state.userAnswer]);

  return (
    <div className="fixed inset-0 bg-jblue flex flex-col items-center justify-center px-4 sm:px-12 z-40">
      <div className="text-jgold font-jeopardy text-xl sm:text-2xl mb-2 uppercase">{c.category}</div>
      <div className="text-jgold font-jeopardy text-3xl sm:text-5xl mb-8">
        {c.isDailyDouble ? `$${state.wager.toLocaleString()}` : `$${c.value}`}
      </div>
      <div className="text-white font-jeopardy text-2xl sm:text-5xl max-w-4xl text-center leading-snug">
        {c.text}
      </div>

      <div className="w-full max-w-2xl mt-10">
        {state.phase === 'clue_active' ? (
          <>
            <Timer
              seconds={clueSeconds}
              active
              onExpire={() => dispatch({ type: 'TIMEOUT_ANSWER' })}
            />
            <button
              onClick={() => {
                dispatch({ type: 'BUZZ_IN' });
                cancelSpeak();
                if (mode === 'voice') onStartListening();
              }}
              className="mt-6 w-full py-4 rounded bg-jgold text-jchrome text-2xl font-bold"
            >
              Buzz In (Space)
            </button>
            <button
              onClick={() => {
                cancelSpeak();
                dispatch({ type: 'TIMEOUT_ANSWER' });
              }}
              className="mt-2 w-full py-2 rounded border border-white/30 text-white/70 hover:text-white text-sm"
            >
              Skip clue (Esc)
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(input);
            }}
            className="flex flex-col gap-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Your answer…"
              className="w-full text-2xl bg-jblueDeep border border-jgold p-4 rounded text-white"
            />
            {mode === 'voice' && voiceListening && (
              <div className="text-center text-jgold">
                <span className="wave-bar" style={{ animationDelay: '0s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.1s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.2s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.3s' }} />
                <span className="ml-2 text-sm">listening…</span>
              </div>
            )}
            <button className="py-3 rounded bg-jgold text-jchrome font-bold text-xl">
              Submit
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AnswerReveal({ state, dispatch, autoAdvanceSeconds = 5 }) {
  const c = state.activeClue;
  const r = state.lastAnswerResult || {};
  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'NEXT_CLUE' }), autoAdvanceSeconds * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 bg-jblue flex flex-col items-center justify-center px-6 z-40">
      <div className={`text-3xl sm:text-5xl font-bold mb-4 ${r.correct ? 'text-jgreen' : 'text-jred'}`}>
        {r.timedOut ? 'Time!' : r.correct ? 'Correct ✓' : 'Incorrect ✗'}
        {!r.timedOut && (
          <span className="ml-3 text-white/80 text-lg">
            {r.delta >= 0 ? '+' : '-'}${Math.abs(r.delta).toLocaleString()}
          </span>
        )}
      </div>
      <div className="text-white/60 text-sm mb-2">Correct response:</div>
      <div className="text-jgold font-jeopardy text-3xl sm:text-5xl mb-6 text-center max-w-4xl">
        {c.answer}
      </div>
      {state.userAnswer && (
        <div className="text-white/70 mb-6">
          You said: <span className="italic">{state.userAnswer}</span>
        </div>
      )}
      <div className="flex gap-3">
        {!r.correct && (
          <button
            onClick={() => dispatch({ type: 'ACCEPT_ANYWAY' })}
            className="px-5 py-2 rounded border border-jgreen text-jgreen hover:bg-jgreen/10"
          >
            Accept Anyway
          </button>
        )}
        <button
          onClick={() => dispatch({ type: 'NEXT_CLUE' })}
          className="px-5 py-2 rounded bg-jgold text-jchrome font-bold"
        >
          Next Clue (Space)
        </button>
      </div>
    </div>
  );
}

function FJCategory({ state, dispatch }) {
  const fj = state.gameData.rounds.finalJeopardy;
  return (
    <div className="text-center py-16">
      <div className="font-jeopardy text-3xl text-white mb-4">This is Final Jeopardy</div>
      <div className="font-jeopardy text-jgold text-5xl mb-8">{fj.category}</div>
      <button
        onClick={() => dispatch({ type: 'BEGIN_FJ_WAGER' })}
        className="px-6 py-3 rounded bg-jgold text-jchrome font-bold"
      >
        Place wager
      </button>
    </div>
  );
}

function FJWager({ state, dispatch }) {
  const max = Math.max(state.score, state.score <= 0 ? 1000 : 0);
  return (
    <div className="text-center py-16">
      <div className="font-jeopardy text-3xl text-jgold mb-4">Your wager</div>
      <div className="text-white/70 mb-6">
        Score: ${state.score.toLocaleString()} · Max: ${max.toLocaleString()}
      </div>
      <input
        type="number"
        min={0}
        max={max}
        value={state.finalJeopardyWager}
        onChange={(e) =>
          dispatch({
            type: 'SET_FJ_WAGER',
            value: Math.max(0, Math.min(max, parseInt(e.target.value || 0, 10))),
          })
        }
        className="text-4xl bg-jblueDeep border border-jgold text-jgold text-center rounded p-3 w-64 font-jeopardy"
      />
      <div className="mt-4">
        <button
          onClick={() => dispatch({ type: 'CONFIRM_FJ_WAGER' })}
          className="px-6 py-3 rounded bg-jgold text-jchrome font-bold"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function FJActive({ state, dispatch, mode, onSubmit, fjSeconds = 30 }) {
  const fj = state.gameData.rounds.finalJeopardy;
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);
  return (
    <div className="text-center py-12">
      <div className="font-jeopardy text-jgold text-2xl mb-2 uppercase">{fj.category}</div>
      <div className="text-white font-jeopardy text-3xl sm:text-5xl max-w-3xl mx-auto leading-snug mb-8">
        {fj.clue.text}
      </div>
      <div className="max-w-xl mx-auto">
        <Timer
          seconds={fjSeconds}
          active
          onExpire={() => onSubmit(input)}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(input);
          }}
          className="mt-5 flex flex-col gap-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Your answer…"
            className="w-full text-2xl bg-jblueDeep border border-jgold p-4 rounded"
          />
          <button className="py-3 rounded bg-jgold text-jchrome font-bold text-xl">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

function FJReveal({ state, dispatch }) {
  const fj = state.gameData.rounds.finalJeopardy;
  const r = state.lastAnswerResult || {};
  return (
    <div className="text-center py-16">
      <div
        className={`text-5xl font-bold mb-4 ${
          r.correct ? 'text-jgreen' : 'text-jred'
        }`}
      >
        {r.correct ? 'Correct ✓' : 'Incorrect ✗'}{' '}
        <span className="text-white/80 text-2xl ml-3">
          {r.delta >= 0 ? '+' : '-'}${Math.abs(r.delta).toLocaleString()}
        </span>
      </div>
      <div className="text-white/60 text-sm mb-2">Correct response:</div>
      <div className="font-jeopardy text-jgold text-4xl mb-6">{fj.clue.answer}</div>
      <div className="flex gap-3 justify-center">
        {!r.correct && (
          <button
            onClick={() => dispatch({ type: 'FJ_ACCEPT_ANYWAY' })}
            className="px-5 py-2 rounded border border-jgreen text-jgreen hover:bg-jgreen/10"
          >
            Accept Anyway
          </button>
        )}
        <button
          onClick={() => dispatch({ type: 'FINISH_GAME' })}
          className="px-6 py-3 rounded bg-jgold text-jchrome font-bold"
        >
          See results
        </button>
      </div>
    </div>
  );
}
