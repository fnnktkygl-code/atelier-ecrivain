/**
 * Unit Tests for Manuscript Reducer
 */

function mergeBlocksContent(p1: string, p2: string): string {
  const needsSpace = p1 && p2 && !/\s$/.test(p1) && !/^\s/.test(p2) && !/[.,!?;:]$/.test(p1);
  return p1 + (needsSpace ? ' ' : '') + p2;
}

export function runTests() {
  console.assert(
    mergeBlocksContent('Fin du premier', 'Début du second') === 'Fin du premier Début du second',
    'Test 1 failed: space should be added'
  );
  console.assert(
    mergeBlocksContent('Premier ', 'Second') === 'Premier Second',
    'Test 2 failed: no double space'
  );
  console.assert(
    mergeBlocksContent('Premier...', 'Second') === 'Premier...Second',
    'Test 3 failed: punctuation preserved'
  );
}
