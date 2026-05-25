export default function Board({ round, revealedClues, onSelectClue }) {
  const cats = round.categories;
  const cluesByCol = {};
  for (let c = 1; c <= 6; c++) cluesByCol[c] = [];
  for (const clue of round.clues) {
    cluesByCol[clue.categoryIndex + 1].push(clue);
  }
  for (let c = 1; c <= 6; c++) {
    cluesByCol[c].sort((a, b) => a.row - b.row);
  }

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
              <div
                key={`empty-${row}-${col}`}
                className="bg-jblueDeep min-h-[60px] sm:min-h-[90px] rounded"
              />
            );
          }
          const done = revealedClues.has(clue.id);
          if (done) {
            return (
              <div
                key={clue.id}
                className="bg-jblueDeep min-h-[60px] sm:min-h-[90px] rounded"
              />
            );
          }
          return (
            <button
              key={clue.id}
              onClick={() => onSelectClue(clue.id)}
              className="cell-bevel min-h-[60px] sm:min-h-[90px] rounded text-jgold font-jeopardy text-xl sm:text-3xl"
            >
              ${clue.value}
            </button>
          );
        })
      )}
    </div>
  );
}
