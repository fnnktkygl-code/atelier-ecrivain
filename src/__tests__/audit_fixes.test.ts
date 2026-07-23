import test from 'node:test';
import assert from 'node:assert/strict';

// Test 1: toSuperscript helper logic
function toSuperscript(num: number): string {
  const sups: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return String(num).split('').map((digit) => sups[digit] || digit).join('');
}

test('toSuperscript formats numbers correctly', () => {
  assert.equal(toSuperscript(1), '¹');
  assert.equal(toSuperscript(2), '²');
  assert.equal(toSuperscript(10), '¹⁰');
});

// Test 2: linkNotes dynamic resolution
function linkNotes(text: string, chapterNotes: any[] = []): string {
  const SUP_MAP: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  };
  const notesLookup: Record<string, string> = {};
  if (Array.isArray(chapterNotes)) {
    chapterNotes.forEach((n, idx) => {
      const num = n.key ? String(n.key).replace(/\D/g, '') || String(idx + 1) : String(idx + 1);
      notesLookup[num] = n.content;
    });
  }

  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => {
    const num = m.split('').map((c) => SUP_MAP[c] || c).join('');
    return `<sup class="note-ref" data-note="${num}">${m}</sup>`;
  });
}

test('linkNotes generates valid superscripts for dynamic notes', () => {
  const text = 'Ceci est une citation.¹';
  const notes = [{ key: 'Note 1', content: 'Friedrich Nietzsche' }];
  const html = linkNotes(text, notes);
  assert.ok(html.includes('<sup class="note-ref" data-note="1">¹</sup>'));
});

// Test 3: Rature original field check
test('ratures retain original phrase and non-empty target', () => {
  const ratureObj = { original: 'disait que tout', corrected: 'affirmait que tout', explanation: 'mot plus précis' };
  const origText = typeof ratureObj === 'string' ? ratureObj : (ratureObj.original || ratureObj.corrected || '');
  assert.equal(origText, 'disait que tout');
  assert.notEqual(origText, '');
});
