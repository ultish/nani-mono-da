const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

// Listens globally for the classic Konami code and calls `callback` once it's
// typed in full. Matches letter keys case-insensitively; resets progress on
// any wrong key (except when that wrong key happens to restart the sequence).
// Returns a function to stop listening.
export function onKonamiCode(callback: () => void): () => void {
  let index = 0;

  function normalize(key: string): string {
    return key.length === 1 ? key.toLowerCase() : key;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    const key = normalize(e.key);
    if (key === normalize(KONAMI_SEQUENCE[index])) {
      index++;
      if (index === KONAMI_SEQUENCE.length) {
        index = 0;
        callback();
      }
    } else {
      index = key === normalize(KONAMI_SEQUENCE[0]) ? 1 : 0;
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}
