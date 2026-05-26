import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchGame } from '../lib/api.js';
import { reducer, initialState } from '../game/reducer.js';
import { checkAnswer } from '../game/answer.js';
import { ding, FinalJeopardyTicker } from '../game/audio.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import Board from '../components/Board.jsx';
import Timer from '../components/Timer.jsx';
import MuteButton from '../components/MuteButton.jsx';
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
  const tickerRef = useRef(null);
  const [showPaTutorial, setShowPaTutorial] = useState(false);

  // Show play-along tutorial the first time the user enters this mode
  useEffect(() => {
    if (mode !== 'playalong' || loading || err) return;
    try {
      if (!localStorage.getItem('jplay-pa-tutorial-seen')) {
        setShowPaTutorial(true);
      }
    } catch {}
  }, [mode, loading, err]);

  function dismissPaTutorial() {
    try {
      localStorage.setItem('jplay-pa-tutorial-seen', '1');
    } catch {}
    setShowPaTutorial(false);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGame(gameId, { withResponses: mode === 'playalong' })
      .then((data) => {
        if (cancelled) return;
        if (mode === 'playalong') {
          const r = data.responses;
          const totalOrdered =
            (r?.rounds?.jeopardy || []).filter((c) => c.order != null).length +
            (r?.rounds?.doubleJeopardy || []).filter((c) => c.order != null).length;
          if (!r || totalOrdered < 5) {
            toast.error(
              "This game's selection-order data isn't available; falling back to Board mode."
            );
            dispatch({ type: 'INIT', gameData: data, mode: 'board' });
            return;
          }
        }
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
      // Block all game-driving keys while the tutorial modal is up
      if (showPaTutorial) return;
      if (state.phase === 'clue_active' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'BUZZ_IN' });
      } else if (state.phase === 'answer_reveal' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'NEXT_CLUE' });
      } else if (state.phase === 'fj_reveal' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'FINISH_GAME' });
      } else if (state.phase === 'round_end' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'ADVANCE_FROM_ROUND_END' });
      } else if (state.phase === 'pa_highlight' && isSpace) {
        e.preventDefault();
        dispatch({ type: 'PA_BEGIN_CLUE' });
      }
      if (e.key === 'Escape' && state.phase !== 'board' && state.phase !== 'game_over') {
        if (state.phase === 'clue_active' || state.phase === 'answer_input') {
          dispatch({ type: 'TIMEOUT_ANSWER' });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Play-along: when entering answer_reveal, also reveal real-game outcome
  useEffect(() => {
    if (state.mode === 'playalong' && state.phase === 'answer_reveal') {
      dispatch({ type: 'PA_REVEAL_OUTCOME' });
    }
  }, [state.mode, state.phase]);

  // FJ ticker
  useEffect(() => {
    if (state.phase === 'fj_active') {
      tickerRef.current = new FinalJeopardyTicker();
      tickerRef.current.start(1000);
      return () => tickerRef.current?.stop();
    }
  }, [state.phase]);

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
      <div className="bg-jchrome px-4 py-2 flex justify-between items-center border-b border-jblueDark gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const progressed =
                state.cluesCorrect + state.cluesIncorrect + state.cluesTimedOut > 0;
              if (
                progressed &&
                !window.confirm('Exit this game? Your progress will be lost.')
              ) {
                return;
              }
              tickerRef.current?.stop();
              nav('/play');
            }}
            title="Exit game"
            className="text-white/70 hover:text-jgold text-sm border border-jblueDark rounded px-2 py-1"
          >
            ← Exit
          </button>
          <div className="font-jeopardy text-jgold text-xl">J! PLAY</div>
        </div>
        <div className="text-sm text-white/70 hidden sm:block">
          {state.gameData.airDate
            ? `Aired ${state.gameData.airDate}`
            : `Game #${state.gameData.gameId}`}{' '}
          · {state.currentRound === 'jeopardy' ? 'Jeopardy' : state.currentRound === 'doubleJeopardy' ? 'Double Jeopardy' : 'Final Jeopardy'}
        </div>
        <div className="flex items-center gap-2">
          <MuteButton />
          <div className="font-jeopardy text-jgold text-xl">
            {state.score < 0 ? '-' : ''}${Math.abs(state.score).toLocaleString()}
          </div>
        </div>
      </div>

      <main className="flex-1 p-3 sm:p-6 max-w-6xl w-full mx-auto">
        {showPaTutorial && <PaTutorial onDismiss={dismissPaTutorial} />}

        {state.mode === 'playalong' && (
          <ContestantScoreboard state={state} />
        )}

        {state.phase === 'pa_highlight' && (
          <PaHighlight
            state={state}
            dispatch={dispatch}
            seconds={settings.paHighlightSeconds}
            paused={showPaTutorial}
          />
        )}

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

function ClueOverlay({ state, dispatch, onSubmit, clueSeconds }) {
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
              onClick={() => dispatch({ type: 'BUZZ_IN' })}
              className="mt-6 w-full py-4 rounded bg-jgold text-jchrome text-2xl font-bold"
            >
              Buzz In (Space)
            </button>
            <button
              onClick={() => dispatch({ type: 'TIMEOUT_ANSWER' })}
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
  const pa = state.mode === 'playalong';
  useEffect(() => {
    if (pa) return; // require explicit Next in play-along (showing contestant info)
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
      {pa && state.paActiveResponse && (
        <ContestantAttempts sel={state.paActiveResponse} />
      )}
      <div className="flex gap-3 flex-wrap justify-center">
        {!r.correct && (
          <button
            onClick={() => dispatch({ type: 'ACCEPT_ANYWAY' })}
            className="px-5 py-2 rounded border border-jgreen text-jgreen hover:bg-jgreen/10"
          >
            Accept Anyway
          </button>
        )}
        {r.correct && (
          <button
            onClick={() => dispatch({ type: 'REJECT_ANYWAY' })}
            className="px-5 py-2 rounded border border-jred text-jred hover:bg-jred/10"
          >
            Reject Anyway
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

function FJActive({ state, dispatch, onSubmit, fjSeconds = 30 }) {
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
      <div className="flex gap-3 justify-center flex-wrap">
        {!r.correct && (
          <button
            onClick={() => dispatch({ type: 'FJ_ACCEPT_ANYWAY' })}
            className="px-5 py-2 rounded border border-jgreen text-jgreen hover:bg-jgreen/10"
          >
            Accept Anyway
          </button>
        )}
        {r.correct && (
          <button
            onClick={() => dispatch({ type: 'FJ_REJECT_ANYWAY' })}
            className="px-5 py-2 rounded border border-jred text-jred hover:bg-jred/10"
          >
            Reject Anyway
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

function ContestantScoreboard({ state }) {
  const youLabel = 'You';
  const all = [
    ...state.contestants,
    { name: youLabel, shortName: youLabel, score: state.score, you: true },
  ];
  const max = Math.max(1000, ...all.map((c) => Math.abs(c.score)));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {all.map((c, i) => (
        <div
          key={i}
          className={`rounded p-2 border ${
            c.you ? 'border-jgold bg-jblueDark' : 'border-jblueDark bg-jblueDeep'
          }`}
        >
          <div className="text-xs truncate text-white/80">
            {c.you ? 'You' : c.shortName || c.name}
          </div>
          <div
            className={`font-jeopardy text-xl ${
              c.score < 0 ? 'text-jred' : 'text-jgold'
            }`}
          >
            {c.score < 0 ? '-' : ''}${Math.abs(c.score).toLocaleString()}
          </div>
          <div className="h-1 bg-jblueDeep rounded mt-1 overflow-hidden">
            <div
              className={`h-full ${c.you ? 'bg-jgold' : 'bg-white/40'}`}
              style={{ width: `${Math.max(2, (Math.max(c.score, 0) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PaHighlight({ state, dispatch, seconds = 5, paused = false }) {
  const sel = state.paQueue[state.paIndex];
  if (!sel || !state.gameData) return null;
  const round =
    sel.round === 'doubleJeopardy'
      ? state.gameData.rounds.doubleJeopardy
      : state.gameData.rounds.jeopardy;
  const clue = round.clues.find((c) => c.id === sel.clueId);
  const category = round.categories[sel.categoryIndex] || '';
  const picker = sel.attempts[0]?.name || pickerFromPrevious(state) || 'Next';

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => dispatch({ type: 'PA_BEGIN_CLUE' }), seconds * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.paIndex, seconds, paused]);

  // Build a faux board with this cell highlighted
  return (
    <div>
      <div className="text-center mb-3 text-white/80">
        <span className="font-jeopardy text-jgold text-lg">
          {picker}
        </span>{' '}
        selects{' '}
        <span className="font-jeopardy text-jgold">
          {category}
        </span>{' '}
        for{' '}
        <span className="font-jeopardy text-jgold">
          ${clue?.value ?? sel.wager ?? ''}
        </span>
      </div>
      <PaBoardHighlight round={round} sel={sel} revealedClues={state.revealedClues} />
      <div className="mt-4 text-center text-white/50 text-xs">
        Press <kbd className="px-1.5 py-0.5 rounded bg-jblueDark text-white/80">Space</kbd> to continue (auto-advances in {seconds}s)
      </div>
    </div>
  );
}

function pickerFromPrevious(state) {
  if (state.paIndex === 0) return null;
  const prev = state.paQueue[state.paIndex - 1];
  return prev?.correctBy || null;
}

function PaBoardHighlight({ round, sel, revealedClues }) {
  const cats = round.categories;
  const cluesByCol = {};
  for (let c = 1; c <= 6; c++) cluesByCol[c] = [];
  for (const clue of round.clues) cluesByCol[clue.categoryIndex + 1].push(clue);
  for (let c = 1; c <= 6; c++) cluesByCol[c].sort((a, b) => a.row - b.row);

  return (
    <div className="grid grid-cols-6 gap-1 sm:gap-2 bg-jblueDeep p-2 rounded">
      {cats.map((cat, i) => (
        <div
          key={`cat-${i}`}
          className="cell-bevel min-h-[60px] sm:min-h-[90px] flex items-center justify-center text-center p-1 sm:p-2"
        >
          <span className="font-jeopardy text-white text-xs sm:text-base leading-tight">
            {cat}
          </span>
        </div>
      ))}
      {[1, 2, 3, 4, 5].map((row) =>
        [1, 2, 3, 4, 5, 6].map((col) => {
          const clue = cluesByCol[col][row - 1];
          if (!clue || !clue.text) {
            return (
              <div key={`empty-${row}-${col}`} className="bg-jblueDeep min-h-[60px] sm:min-h-[90px] rounded" />
            );
          }
          const done = revealedClues.has(clue.id);
          const isHighlight = clue.id === sel.clueId;
          if (done && !isHighlight) {
            return <div key={clue.id} className="bg-jblueDeep min-h-[60px] sm:min-h-[90px] rounded" />;
          }
          return (
            <div
              key={clue.id}
              className={`min-h-[60px] sm:min-h-[90px] rounded font-jeopardy text-xl sm:text-3xl flex items-center justify-center ${
                isHighlight
                  ? 'bg-jgold text-jchrome animate-pulse ring-4 ring-jgold/60'
                  : 'cell-bevel text-jgold'
              }`}
            >
              ${clue.value}
            </div>
          );
        })
      )}
    </div>
  );
}

function ContestantAttempts({ sel }) {
  if (!sel) return null;
  const responsesByName = {};
  for (const r of sel.responses || []) responsesByName[r.name] = r.response;
  return (
    <div className="mt-2 mb-6 max-w-xl w-full bg-jblueDeep border border-jblueDark rounded p-3 text-sm">
      <div className="text-xs uppercase text-white/50 mb-2">In the real game</div>
      {sel.attempts.length === 0 && (
        <div className="text-white/70">
          {sel.isTripleStumper ? 'Triple stumper — no one rang in correctly.' : 'No buzz-in recorded.'}
        </div>
      )}
      {sel.attempts.map((a, i) => (
        <div key={i} className="flex justify-between gap-3 py-1 border-t border-jblueDark/40 first:border-0">
          <span className={a.correct ? 'text-jgreen' : 'text-jred'}>
            {a.correct ? '✓' : '✗'} {a.name}
          </span>
          {responsesByName[a.name] && (
            <span className="italic text-white/70 truncate">
              “{responsesByName[a.name]}”
            </span>
          )}
        </div>
      ))}
      {sel.isTripleStumper && sel.attempts.length > 0 && (
        <div className="mt-1 text-jred text-xs">Triple stumper.</div>
      )}
    </div>
  );
}


function PaTutorial({ onDismiss }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-jchrome border border-jgold rounded-lg p-6">
        <div className="font-jeopardy text-3xl text-jgold mb-3">How Play Along works</div>
        <ol className="space-y-3 text-sm text-white/85 list-decimal pl-5">
          <li>The board appears with all 3 contestants and you on a running scoreboard at the top.</li>
          <li>Each clue is highlighted on the board in the same order it was selected on the real show. You get ~5 seconds to take it in &mdash; or press <kbd className="px-1 rounded bg-jblueDark">Space</kbd> to jump straight into the clue.</li>
          <li>Answer like normal. <span className="text-jgold">Accept Anyway</span> / <span className="text-jred">Reject Anyway</span> let you override the judge.</li>
          <li>After your result, the &ldquo;In the real game&rdquo; panel reveals who buzzed in and what they said. Contestant scores update by the real outcome; yours updates by what you typed.</li>
          <li>Daily Doubles: the real contestant who got it had their own wager &mdash; you place yours separately for your score.</li>
        </ol>
        <button
          onClick={onDismiss}
          className="mt-5 w-full py-3 rounded bg-jgold text-jchrome font-bold"
        >
          Got it &mdash; let&apos;s play
        </button>
      </div>
    </div>
  );
}
