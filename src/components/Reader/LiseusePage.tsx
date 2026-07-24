'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { CHAPTERS } from '@/data/chapters';
import { NOTES } from '@/data/notes';
import { useAuth } from '@/components/Auth/AuthProvider';
import { useTheme } from '@/components/Shared/ThemeProvider';
import { getChapters } from '@/services/firebase/firestore';
import { normalizeChapterNotesAndSuperscripts } from '@/hooks/useManuscript';

const SUP_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

function linkNotes(text: string, chapterNotes: any[] = []): string {
  const notesLookup: Record<string, string> = {};

  if (Array.isArray(chapterNotes) && chapterNotes.length > 0) {
    chapterNotes.forEach((n, idx) => {
      const num = n.key ? String(n.key).replace(/\D/g, '') || String(idx + 1) : String(idx + 1);
      notesLookup[num] = n.content;
    });
  } else {
    Object.assign(notesLookup, NOTES);
  }

  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => {
    const num = m.split('').map((c) => SUP_MAP[c] || c).join('');
    if (!notesLookup[num]) return m;
    return `<sup class="note-ref" data-note="${num}" tabindex="0" role="button" aria-label="Voir la note ${num}">${m}</sup>`;
  });
}

// ── Highlight system ──
interface Highlight {
  id: string;
  text: string;
  color: string;
}

const HL_COLORS: { name: string; value: string; bg: string }[] = [
  { name: 'Jaune', value: '#fef08a', bg: 'rgba(254,240,138,0.45)' },
  { name: 'Vert', value: '#bbf7d0', bg: 'rgba(187,247,208,0.45)' },
  { name: 'Bleu', value: '#bfdbfe', bg: 'rgba(191,219,254,0.45)' },
  { name: 'Rose', value: '#fbcfe8', bg: 'rgba(251,207,232,0.45)' },
  { name: 'Orange', value: '#fed7aa', bg: 'rgba(254,215,170,0.45)' },
];

const HL_STORAGE_KEY = 'liseuse-highlights-v1';

function loadHighlights(): Highlight[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HL_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveHighlights(hls: Highlight[]) {
  localStorage.setItem(HL_STORAGE_KEY, JSON.stringify(hls));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Apply highlights to HTML by wrapping matching text in <mark> tags */
function applyHighlights(html: string, highlights: Highlight[]): string {
  let result = html;
  // Sort by length descending to match longer phrases first
  const sorted = [...highlights].sort((a, b) => b.text.length - a.text.length);
  for (const hl of sorted) {
    // Only match text outside of HTML tags
    const pattern = new RegExp(`(?<=>)([^<]*?)(${escapeRegex(hl.text)})([^<]*?)(?=<)`, 'g');
    result = result.replace(pattern, (_, before, match, after) =>
      `>${before}<mark class="hl" data-hl-id="${hl.id}" style="background:${hl.color};border-radius:2px;padding:0 1px;cursor:pointer">${match}</mark>${after}<`
    );
    // Remove the extra > and < we added in the lookbehind/lookahead simulation
    // Actually the regex already handles this correctly via the capture groups
  }
  return result;
}

function escapeHTML(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderParagraph(raw: string, chapterNotes: any[] = []): string {
  const p = (raw || '').trim();
  if (!p) return '';
  if (p.startsWith('>')) {
    const content = escapeHTML(p.replace(/^>\s*/, ''));
    return `<blockquote>${linkNotes(content, chapterNotes)}</blockquote>`;
  }
  if (p.startsWith('## ')) {
    const content = escapeHTML(p.replace(/^##\s*/, ''));
    return `<h3>${linkNotes(content, chapterNotes)}</h3>`;
  }
  if (p.startsWith('# ')) {
    const content = escapeHTML(p.replace(/^#\s*/, ''));
    return `<h2>${linkNotes(content, chapterNotes)}</h2>`;
  }
  return `<p>${linkNotes(escapeHTML(p), chapterNotes)}</p>`;
}

function buildAllHTML(chapters: any[], highlights: Highlight[]): string {
  let html = chapters.map((ch, ci) => {
    const eyebrow = ch.title.includes('—') ? ch.title.split('—')[0]?.trim() : `Chapitre ${ci + 1}`;
    const shortTitle = ch.title.includes('—') ? ch.title.split('—')[1]?.trim() : ch.title;
    const hasContent = ch.paragraphs && ch.paragraphs.some((p: string) => p && p.trim().length > 0);
    const chapterNotes = ch.notes || [];
    const parasHTML = hasContent
      ? ch.paragraphs.map((p: string) => renderParagraph(p, chapterNotes)).filter(Boolean).join('')
      : '<p style="font-style: italic; opacity: 0.6;">(Chapitre vide)</p>';
    return `
      <div class="col-chapter" data-chapter="${ci}">
        <div class="col-chapter-header">
          <div class="col-eyebrow">${eyebrow}</div>
          <h2 class="col-title">${shortTitle}</h2>
        </div>
        ${parasHTML}
      </div>
    `;
  }).join('');

  if (highlights.length > 0) {
    html = applyHighlights(html, highlights);
  }
  return html;
}

const COLUMN_GAP = 80;

const BOOKMARK_KEY = 'liseuse-bookmarks-v1';

interface Bookmark {
  page: number;
  chapter: number;
  label: string;
}

function loadBookmarks(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]'); }
  catch { return []; }
}

const SETTINGS_KEY = 'liseuse-settings-v1';

interface ReaderSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 19,
  fontFamily: "'Source Serif 4', Georgia, serif",
  lineHeight: 1.85,
};

const FONT_OPTIONS = [
  { label: 'Roman (Serif)', value: "'Source Serif 4', Georgia, serif" },
  { label: 'Éditorial (Merriweather)', value: "'Merriweather', Georgia, serif" },
  { label: 'Classique (Garamond)', value: "'Cormorant Garamond', 'Garamond', serif" },
  { label: 'Moderne (Sans-serif)', value: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { label: 'Monospace (Notes)', value: "'JetBrains Mono', monospace" },
];

const THEME_OPTIONS: { label: string; value: 'day' | 'sepia' | 'night'; bg: string; text: string }[] = [
  { label: 'Jour', value: 'day', bg: '#efe7d5', text: '#2c2417' },
  { label: 'Sépia', value: 'sepia', bg: '#e8d9b8', text: '#3a2f1c' },
  { label: 'Nuit', value: 'night', bg: '#1b1a17', text: '#d8d0bd' },
];

function loadSettings(): ReaderSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(s: ReaderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function formatChaptersForLiseuse(rawChapters: any[]): any[] {
  const editableChapters = rawChapters.map((ch: any, idx: number) => ({
    id: ch.id || `ch-${idx}`,
    title: ch.title || `Chapitre ${idx + 1}`,
    blocks: ch.blocks
      ? ch.blocks.map((b: any, bIdx: number) => ({
          id: b.id || `b-${bIdx}`,
          content: (b && b.content) || '',
          type: 'paragraph' as const,
          source: 'original' as const,
          createdAt: 0,
        }))
      : (ch.paragraphs || []).map((p: string, pIdx: number) => ({
          id: `p-${pIdx}`,
          content: p,
          type: 'paragraph' as const,
          source: 'original' as const,
          createdAt: 0,
        })),
    notes: ch.notes && ch.notes.length > 0 ? ch.notes : [],
    pendingReviews: [],
  }));

  const normalized = normalizeChapterNotesAndSuperscripts(editableChapters);
  return normalized.map((ch) => ({
    title: ch.title,
    paragraphs: ch.blocks.map((b) => b.content),
    notes: ch.notes,
  }));
}

export default function LiseusePage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [scrollMode, setScrollMode] = useState(false);
  const [notePopup, setNotePopup] = useState<{ num: string; text: string } | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selPopup, setSelPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);

  const viewportRef = useRef<HTMLDivElement>(null);
  const colFlowRef = useRef<HTMLDivElement>(null);
  const colWidthRef = useRef(0);
  const [, forceUpdate] = useState(0);

  const { user, manuscript } = useAuth();
  const { theme, setTheme } = useTheme();
  const currentManuscriptId = manuscript?.id || 'default';

  const [chapters, setChapters] = useState<any[]>(() => {
    const rawChapters = CHAPTERS.map((ch, idx) => ({
      id: `ch-${idx}`,
      title: ch.title,
      blocks: ch.paragraphs.map((p) => ({
        id: `b-${idx}`,
        content: p,
        type: 'paragraph' as const,
        source: 'original' as const,
        createdAt: 0,
      })),
      notes: [],
      pendingReviews: [],
    }));

    const normalized = normalizeChapterNotesAndSuperscripts(rawChapters);
    return normalized.map((ch) => ({
      title: ch.title,
      paragraphs: ch.blocks.map((b) => b.content),
      notes: ch.notes,
    }));
  });

  const loadManuscript = useCallback(() => {
    let loaded = false;
    try {
      const keysToScan: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('atelier-manuscrit')) {
          keysToScan.push(k);
        }
      }
      const explicitKeys = [
        `atelier-manuscrit-v4-${currentManuscriptId}`,
        `atelier-manuscrit-${currentManuscriptId}`,
        'atelier-manuscrit-default',
        'atelier-manuscrit-v1',
      ];
      explicitKeys.forEach((k) => {
        if (!keysToScan.includes(k)) keysToScan.push(k);
      });

      let bestParsed: any = null;
      for (const k of keysToScan) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const p = JSON.parse(raw);
            if (p && p.chapters && Array.isArray(p.chapters) && p.chapters.length > 0) {
              if (!bestParsed) {
                bestParsed = p;
              } else if (p.chapters.length > bestParsed.chapters.length) {
                bestParsed = p;
              } else if (p.chapters.length === bestParsed.chapters.length) {
                const pSaved = p.lastSaved || 0;
                const bestSaved = bestParsed.lastSaved || 0;
                if (pSaved >= bestSaved) {
                  bestParsed = p;
                }
              }
            }
          }
        } catch {}
      }

      if (bestParsed && bestParsed.chapters && bestParsed.chapters.length > 0) {
        const staticChapters = CHAPTERS;
        const rawChaptersToFormat = bestParsed.chapters.map((c: any, idx: number) => ({
          ...c,
          notes: c.notes && c.notes.length > 0 ? c.notes : (staticChapters[idx] as any)?.notes || [],
        }));
        const formatted = formatChaptersForLiseuse(rawChaptersToFormat);
        setChapters(formatted);
        loaded = true;
      }
    } catch (e) {
      console.error('Error loading manuscript in Liseuse:', e);
    }

    if (!loaded && user && manuscript?.id) {
      getChapters(user.uid, manuscript.id)
        .then((fsChapters) => {
          if (fsChapters && fsChapters.length > 0) {
            const formatted = formatChaptersForLiseuse(fsChapters);
            setChapters(formatted);
          }
        })
        .catch((err) => console.error('Error loading Firestore chapters in Liseuse:', err));
    }
  }, [currentManuscriptId, user, manuscript?.id]);

  // Load from localStorage and listen to updates
  useEffect(() => {
    setHighlights(loadHighlights());
    setSettings(loadSettings());

    loadManuscript();

    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('atelier-manuscrit')) {
        loadManuscript();
      }
    };

    const handleCustomUpdate = () => {
      loadManuscript();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('atelier_manuscript_updated', handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('atelier_manuscript_updated', handleCustomUpdate);
    };
  }, [loadManuscript, currentManuscriptId]);



  const updateSettings = (patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  // Build HTML with highlights applied
  const allHTML = buildAllHTML(chapters, highlights);

  // ── Measure column width and total pages synchronously ──
  const measurePages = useCallback(() => {
    const vp = viewportRef.current;
    const flow = colFlowRef.current;
    if (!vp || !flow) return;

    // Calculate content area width from viewport (sub-pixel precision)
    const vpStyle = getComputedStyle(vp);
    const padL = parseFloat(vpStyle.paddingLeft);
    const padR = parseFloat(vpStyle.paddingRight);
    const colWidth = vp.getBoundingClientRect().width - padL - padR;
    if (colWidth <= 0) return;

    // Set column-width directly on the DOM for measurement
    flow.style.columnWidth = `${colWidth}px`;
    flow.style.transform = 'none';

    // Force synchronous reflow to get accurate scrollWidth
    void flow.offsetHeight;
    const sw = flow.scrollWidth;

    const total = Math.max(1, Math.round((sw + COLUMN_GAP) / (colWidth + COLUMN_GAP)));

    // Store in ref (no async delay)
    colWidthRef.current = colWidth;

    // Apply the correct transform immediately (before paint)
    const page = Math.min(currentPage, total - 1);
    flow.style.transform = `translateX(${-page * (colWidth + COLUMN_GAP)}px)`;

    // Update React state for UI elements (page counter, progress bar, etc.)
    setTotalPages(total);
    if (page !== currentPage) setCurrentPage(page);
  }, [currentPage]);

  // Run measurement synchronously before paint
  useLayoutEffect(() => {
    if (scrollMode) return;
    measurePages();
  });

  // Also measure on resize and font load
  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1); // triggers re-render → useLayoutEffect
    window.addEventListener('resize', handler);
    document.fonts?.ready?.then(() => setTimeout(handler, 50));
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Recalc when highlights change (since HTML content changes)
  useEffect(() => {
    forceUpdate((n) => n + 1);
  }, [highlights]);

  // ── Navigation ──
  const goNext = useCallback(() => {
    setCurrentPage((p) => (p >= totalPages - 1 ? p : p + 1));
  }, [totalPages]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => (p <= 0 ? p : p - 1));
  }, []);

  // Helper to resolve note text strictly scoped to the chapter column
  // Helper to resolve note text strictly scoped to the chapter column
  const getNoteContentFromRef = useCallback((refEl: HTMLElement): { num: string; text: string } | null => {
    const num = refEl.dataset.note || '';
    if (!num) return null;

    const chapterCol = refEl.closest('.col-chapter') as HTMLElement | null;
    const chIndexStr = chapterCol?.dataset.chapter;
    const chIndex = chIndexStr !== undefined ? parseInt(chIndexStr, 10) : -1;

    let noteText: string | undefined;

    // 1. Try matching in the specific chapter containing this note
    if (chIndex >= 0 && chapters && chapters[chIndex]) {
      const ch = chapters[chIndex];
      if (ch.notes && Array.isArray(ch.notes) && ch.notes.length > 0) {
        const noteIdx = parseInt(num, 10) - 1;
        const found = ch.notes.find((n: any, idx: number) => {
          const nNum = n.key ? String(n.key).replace(/\D/g, '') || String(idx + 1) : String(idx + 1);
          return nNum === num || idx === noteIdx;
        }) || ch.notes[noteIdx];

        if (found) {
          noteText = typeof found === 'string' ? found : (found.content || found.text);
        }
      }
    }

    // 2. Only if chapter column was NOT found at all, search across chapters
    if (!noteText && chIndex === -1 && chapters) {
      for (const ch of chapters) {
        if (ch.notes && Array.isArray(ch.notes) && ch.notes.length > 0) {
          const noteIdx = parseInt(num, 10) - 1;
          const found = ch.notes.find((n: any, idx: number) => {
            const nNum = n.key ? String(n.key).replace(/\D/g, '') || String(idx + 1) : String(idx + 1);
            return nNum === num || idx === noteIdx;
          }) || ch.notes[noteIdx];

          if (found) {
            noteText = typeof found === 'string' ? found : (found.content || found.text);
            break;
          }
        }
      }
    }

    return noteText ? { num, text: noteText } : null;
  }, [chapters]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl.classList.contains('note-ref') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        const res = getNoteContentFromRef(activeEl);
        if (res) setNotePopup(res);
        return;
      }
      if (scrollMode) return;
      if (e.key === 'ArrowRight' || (e.key === ' ' && !activeEl?.classList.contains('note-ref'))) { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'Escape') { setNotePopup(null); setSelPopup(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [scrollMode, goNext, goPrev, getNoteContentFromRef]);

  // Touch swipe
  useEffect(() => {
    if (scrollMode) return;
    const el = viewportRef.current;
    if (!el) return;
    let sx = 0, sy = 0, active = false;
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; active = true; };
    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) goNext(); else goPrev();
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, [scrollMode, goNext, goPrev]);

  // ── Text Selection → Highlight popup ──
  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay to let the selection finalize
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          return;
        }
        const text = sel.toString().trim();
        if (text.length < 3) return; // Minimum 3 characters

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setSelPopup({
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
          text,
        });
      }, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  // Close selection popup when clicking elsewhere
  useEffect(() => {
    if (!selPopup) return;
    const dismiss = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.hl-popup')) return;
      setSelPopup(null);
    };
    setTimeout(() => document.addEventListener('mousedown', dismiss), 50);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [selPopup]);

  // Add highlight
  const addHighlight = (color: string) => {
    if (!selPopup) return;
    const newHL: Highlight = {
      id: `hl-${Date.now()}`,
      text: selPopup.text,
      color,
    };
    const updated = [...highlights, newHL];
    setHighlights(updated);
    saveHighlights(updated);
    setSelPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  // Remove highlight (click on existing highlight)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const mark = (e.target as HTMLElement).closest('mark.hl') as HTMLElement | null;
      if (mark) {
        e.stopPropagation();
        const hlId = mark.dataset.hlId;
        if (hlId) {
          const updated = highlights.filter((h) => h.id !== hlId);
          setHighlights(updated);
          saveHighlights(updated);
        }
      }
    };
    document.addEventListener('dblclick', handler);
    return () => document.removeEventListener('dblclick', handler);
  }, [highlights]);

  // Click to navigate or toggle UI (but NOT when text is selected)
  const handlePageClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.note-ref')) return;
    if ((e.target as HTMLElement).closest('mark.hl')) return;
    if (window.getSelection()?.toString().trim()) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    if (xPct < 0.3) goPrev();
    else if (xPct > 0.7) goNext();
  };

  // Note clicks
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const ref = (e.target as HTMLElement).closest('.note-ref') as HTMLElement | null;
      if (ref) {
        e.stopPropagation();
        const res = getNoteContentFromRef(ref);
        if (res) setNotePopup(res);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [getNoteContentFromRef]);

  // ── Translation ──
  const colWidthPx = colWidthRef.current;

  const currentChapterIndex = (() => {
    const flow = colFlowRef.current;
    if (!flow || colWidthPx <= 0) return 0;
    const offset = currentPage * (colWidthPx + COLUMN_GAP);
    const chapters = flow.querySelectorAll('.col-chapter');
    let lastCI = 0;
    chapters.forEach((ch) => {
      const el = ch as HTMLElement;
      if (el.offsetLeft <= offset + colWidthPx / 2) {
        lastCI = parseInt(el.dataset.chapter || '0');
      }
    });
    return lastCI;
  })();

  const progressPct = totalPages > 1 ? ((currentPage + 1) / totalPages) * 100 : 100;
  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1;

  return (
    <>
      <style>{`
        .liseuse-wrap {
          display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden;
          background: var(--bg); color: var(--text); transition: background-color .3s ease, color .3s ease;
          --reader-font-size:${settings.fontSize}px;
          --reader-font-family:${settings.fontFamily};
          --reader-line-height:${settings.lineHeight};
        }
        .liseuse-topbar {
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding:8px 18px; font-family:'Cormorant Garamond', serif; z-index:20;
          color:var(--text-soft); flex-shrink:0; transition: opacity .3s ease;
          flex-wrap: wrap; /* Prevent overflow */
        }
        .liseuse-topbar .brand { font-size:13px; letter-spacing:.06em; text-transform:uppercase; opacity:.7; }
        .liseuse-topbar .controls { display:flex; gap:6px; align-items:center; }

        /* ── Font size controls ── */
        .font-controls {
          display:flex; align-items:center; gap:2px;
          border:1px solid var(--border); border-radius:16px;
          padding:2px 4px;
        }
        .font-btn {
          background:none; border:none; color:var(--text-soft);
          font-family:'Cormorant Garamond', serif; cursor:pointer;
          width:26px; height:26px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          transition:all .15s;
        }
        .font-btn:hover { color:var(--text); background:var(--hover); }
        .font-btn-small { font-size:12px; font-weight:600; }
        .font-btn-large { font-size:18px; font-weight:600; }
        .font-divider { width:1px; height:16px; background:var(--border); margin:0 2px; }

        .reader-main {
          position:relative; flex:1; min-height:0;
          display:flex; align-items:stretch; justify-content:center;
          padding: 0;
        }
        .page-frame {
          flex: 1; max-width: 1100px; margin: 0 auto;
          background: var(--surface); position: relative; overflow: hidden;
          cursor: pointer; transition: background-color .5s ease;
          box-shadow: 0 0 1px rgba(0,0,0,.08);
        }
        .page-frame::before {
          content:''; position:absolute; inset:0;
          background: linear-gradient(120deg, rgba(0,0,0,0.012), transparent 20%);
          pointer-events:none; z-index:3;
        }
        .page-frame::after {
          content:''; position:absolute; left:0; top:0; bottom:0; width:12px;
          background: linear-gradient(to right, rgba(0,0,0,.06), transparent);
          pointer-events:none; z-index:3;
        }

        .col-viewport {
          position: absolute; inset: 0;
          padding: 48px 64px 56px;
          overflow: hidden; z-index: 2;
        }
        .col-flow {
          column-count: auto; column-fill: auto;
          column-gap: ${COLUMN_GAP}px;
          height: 100%;
        }
        .col-chapter { break-inside: auto; }
        .col-chapter-header { break-after: avoid; margin-bottom: 20px; }
        .col-eyebrow {
          font-family:'Cormorant Garamond', serif; font-size:11px;
          letter-spacing:.22em; text-transform:uppercase; color:var(--accent);
          margin:0 0 4px; opacity:.8;
        }
        .col-title {
          font-family:'Cormorant Garamond', serif; font-weight:600;
          font-size: 24px; line-height:1.3; color:var(--text);
          margin:0; padding-bottom:16px; border-bottom:1px solid var(--border);
        }
        .col-flow p {
          font-size: var(--reader-font-size); font-family: var(--reader-font-family);
          line-height: var(--reader-line-height); color: var(--text);
          margin: 0 0 1.05em; text-align: justify;
          hyphens: auto; -webkit-hyphens: auto;
          orphans: 2; widows: 2; break-inside: auto;
        }
        .page-footer-overlay {
          position:absolute; bottom:0; left:0; right:0;
          display:flex; justify-content:space-between; align-items:center;
          font-family:'Cormorant Garamond', serif; font-size:12px;
          color:var(--text-soft); letter-spacing:.05em;
          padding: 12px 64px 16px;
          background: linear-gradient(to top, var(--surface) 70%, transparent);
          z-index:4;
        }
        .nav-arrow {
          position:absolute; top:50%; transform:translateY(-50%);
          width:44px; height:44px; border-radius:50%;
          border:1px solid var(--border); color:var(--text-soft);
          background: var(--surface);
          display:flex; align-items:center; justify-content:center;
          font-size:20px; cursor:pointer; z-index:15; transition: all .2s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,.1); opacity: 0.7;
        }
        .nav-arrow:hover { opacity:1; box-shadow: 0 4px 16px rgba(0,0,0,.15); transform:translateY(-50%) scale(1.05); }
        .nav-arrow.left { left:16px; }
        .nav-arrow.right { right:16px; }
        .nav-arrow[disabled] { opacity:.15; cursor:default; pointer-events:none; box-shadow:none; }

        .progress-wrap {
          position:absolute; bottom:0; left:0; right:0;
          display:flex; align-items:center; gap:10px;
          font-family:'Cormorant Garamond', serif; font-size:11.5px;
          color:var(--text-soft); padding:10px 64px;
          background: var(--surface-2); border-top: 1px solid var(--border);
          z-index: 10;
        }
        .progress-track { flex:1; height:5px; background:var(--border); position:relative; border-radius:3px; cursor:pointer; }
        .progress-fill { position:absolute; left:0; top:0; bottom:0; background:var(--accent); border-radius:3px; transition:width .4s ease; }
        .progress-chapter-name {
          font-style:italic; font-size:10.5px; opacity:.7; max-width:180px;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }



        /* ── Bookmark ── */
        .bookmark-btn {
          position:absolute; top:8px; right:20px; z-index:5;
          background:none; border:none; font-size:24px;
          cursor:pointer; opacity:.4; transition:all .2s;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,.1));
        }
        .bookmark-btn:hover { opacity:.8; transform:scale(1.1); }
        .bookmark-btn.active { opacity:1; }

        /* ── TOC drawer ── */
        .toc-overlay {
          position:fixed; inset:0; z-index:998;
          background:rgba(0,0,0,.35); backdrop-filter:blur(3px);
          opacity:0; pointer-events:none; transition:opacity .3s ease;
        }
        .toc-overlay.open { opacity:1; pointer-events:auto; }
        .toc-drawer {
          position:fixed; top:0; left:0; bottom:0;
          width:320px; max-width:85vw; z-index:999;
          background:var(--surface); box-shadow:8px 0 32px rgba(0,0,0,.12);
          transform:translateX(-100%); transition:transform .32s cubic-bezier(.22,.68,0,1);
          display:flex; flex-direction:column; overflow-y:auto;
          padding:28px 24px;
        }
        .toc-drawer.open { transform:translateX(0); }
        .toc-title {
          font-family:'Cormorant Garamond', serif;
          font-size:11px; font-weight:600; letter-spacing:.2em;
          text-transform:uppercase; color:var(--accent);
          margin:0 0 20px;
        }
        .toc-item {
          display:flex; align-items:center; gap:12px;
          padding:12px 14px; border-radius:10px;
          cursor:pointer; transition:all .18s;
          border:1px solid transparent; margin-bottom:4px;
          text-decoration:none; color:inherit;
        }
        .toc-item:hover { background:var(--hover); }
        .toc-item.active { background:rgba(138,90,52,.08); border-color:var(--accent); }
        .toc-item-number {
          font-family:'Cormorant Garamond', serif;
          font-size:11px; font-weight:600; color:var(--accent);
          min-width:24px;
        }
        .toc-item-title {
          font-family:'Cormorant Garamond', serif;
          font-size:14px; font-weight:600; color:var(--text);
          flex:1;
        }
        .toc-item-words {
          font-size:11px; color:var(--text-soft);
          font-family:'Cormorant Garamond', serif;
        }
        .toc-section-title {
          font-family:'Cormorant Garamond', serif;
          font-size:10px; font-weight:600; letter-spacing:.16em;
          text-transform:uppercase; color:var(--text-soft);
          margin:20px 0 10px; opacity:.6;
        }
        .toc-bookmark-item {
          display:flex; align-items:center; gap:10px;
          padding:8px 14px; border-radius:8px;
          cursor:pointer; transition:all .18s;
          font-size:13px; color:var(--text-soft);
          font-family:'Cormorant Garamond', serif;
        }
        .toc-bookmark-item:hover { background:var(--hover); color:var(--text); }
        .toc-close {
          position:absolute; top:16px; right:16px;
          background:none; border:none; color:var(--text-soft);
          font-size:20px; cursor:pointer; width:32px; height:32px;
          border-radius:50%; display:flex; align-items:center; justify-content:center;
          transition:all .2s;
        }
        .toc-close:hover { background:var(--hover); color:var(--text); }

        /* ── Settings panel ── */
        .settings-overlay {
          position:fixed; inset:0; z-index:996;
          background:rgba(0,0,0,.25); backdrop-filter:blur(2px);
          opacity:0; pointer-events:none; transition:opacity .3s ease;
        }
        .settings-overlay.open { opacity:1; pointer-events:auto; }
        .settings-panel {
          position:fixed; bottom:0; left:50%; transform:translate(-50%, 100%);
          width:min(94vw, 420px); background:var(--surface);
          border-radius:20px 20px 0 0; box-shadow:0 -8px 40px rgba(0,0,0,.18);
          padding:20px 24px 28px; z-index:997;
          transition:transform .32s cubic-bezier(.22,.68,0,1);
        }
        .settings-panel.open { transform:translate(-50%, 0); }
        .settings-panel::before { content:''; display:block; width:36px; height:4px; border-radius:3px; background:var(--border); margin:0 auto 16px; opacity:.6; }
        .settings-section-title {
          font-family:'Cormorant Garamond', serif;
          font-size:10px; font-weight:600; letter-spacing:.18em;
          text-transform:uppercase; color:var(--accent);
          margin:0 0 10px;
        }
        .settings-row {
          display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;
        }
        .settings-chip {
          padding:7px 14px; border-radius:8px;
          border:1px solid var(--border); background:transparent;
          font-family:'Cormorant Garamond', serif;
          font-size:12.5px; cursor:pointer; color:var(--text-soft);
          transition:all .15s;
        }
        .settings-chip:hover { border-color:var(--accent); color:var(--text); }
        .settings-chip.active {
          background:rgba(138,90,52,.1); border-color:var(--accent);
          color:var(--accent); font-weight:600;
        }
        .theme-btn {
          flex:1; padding:10px 0; border-radius:10px;
          border:2px solid transparent; cursor:pointer;
          display:flex; flex-direction:column; align-items:center; gap:4px;
          transition:all .15s;
        }
        .theme-btn:hover { border-color:var(--border); }
        .theme-btn.active { border-color:var(--accent); }
        .theme-preview {
          width:36px; height:36px; border-radius:8px;
          border:1px solid rgba(0,0,0,.08);
        }
        .theme-label {
          font-family:'Cormorant Garamond', serif;
          font-size:11px; color:var(--text-soft);
        }
        .settings-slider-row {
          display:flex; align-items:center; gap:12px; margin-bottom:16px;
        }
        .settings-slider-label {
          font-family:'Cormorant Garamond', serif;
          font-size:12px; color:var(--text-soft); min-width:50px;
        }
        .settings-slider {
          flex:1; -webkit-appearance:none; appearance:none;
          height:4px; border-radius:2px; background:var(--border);
          outline:none;
        }
        .settings-slider::-webkit-slider-thumb {
          -webkit-appearance:none; width:18px; height:18px;
          border-radius:50%; background:var(--accent); cursor:pointer;
          border:2px solid var(--surface);
          box-shadow:0 1px 4px rgba(0,0,0,.15);
        }
        .settings-slider-value {
          font-family:'Cormorant Garamond', serif;
          font-size:12px; color:var(--text); min-width:30px; text-align:right;
        }

        /* ── Page number overlay ── */
        .page-number-center {
          position:absolute; top:12px; left:50%; transform:translateX(-50%);
          font-family:'Cormorant Garamond', serif;
          font-size:12px; color:var(--text-soft); opacity:.5;
          letter-spacing:.1em; z-index:4; pointer-events:none;
        }

        /* ── Highlight system ── */
        mark.hl { transition: opacity .15s ease; }
        mark.hl:hover { opacity:.7; }

        .hl-popup {
          position: fixed; z-index: 60;
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,.18), 0 1px 4px rgba(0,0,0,.08);
          transform: translateX(-50%) translateY(-100%);
          animation: hlPopIn .18s ease;
        }
        @keyframes hlPopIn {
          from { opacity:0; transform:translateX(-50%) translateY(-90%) scale(.92); }
          to { opacity:1; transform:translateX(-50%) translateY(-100%) scale(1); }
        }
        .hl-popup::after {
          content:''; position:absolute; bottom:-5px; left:50%; transform:translateX(-50%) rotate(45deg);
          width:10px; height:10px; background:var(--surface); border-right:1px solid var(--border); border-bottom:1px solid var(--border);
        }
        .hl-color-btn {
          width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent;
          cursor: pointer; transition: all .15s ease; flex-shrink:0;
        }
        .hl-color-btn:hover { transform: scale(1.18); border-color: var(--text-soft); }
        .hl-popup-label {
          font-family:'Cormorant Garamond', serif; font-size:12px;
          color:var(--text-soft); letter-spacing:.04em; white-space:nowrap;
          margin-right:4px;
        }

        /* ── Notes ── */
        .note-ref { color:var(--accent); cursor:pointer; font-weight:600; padding:0 1px; border-radius:3px; transition:background-color .15s ease; }
        .note-ref:hover { background:rgba(138,90,52,0.16); }
        .note-overlay-liseuse { position:fixed; inset:0; background:rgba(20,17,10,0.38); backdrop-filter:blur(1.5px); opacity:0; pointer-events:none; transition:opacity .28s ease; z-index:40; }
        .note-overlay-liseuse.show { opacity:1; pointer-events:auto; }
        .note-popup-liseuse { position:fixed; left:50%; bottom:0; transform:translate(-50%, 100%); width:min(92vw, 520px); max-height:min(55vh, 420px); background:var(--surface-2); border-radius:16px 16px 0 0; box-shadow:0 -6px 32px rgba(0,0,0,0.22); padding:14px 24px 24px; z-index:50; opacity:0; transition:transform .32s cubic-bezier(.32,.72,.35,1), opacity .28s ease; display:flex; flex-direction:column; }
        .note-popup-liseuse.show { transform:translate(-50%, 0%); opacity:1; }
        .note-popup-liseuse::before { content:''; display:block; width:36px; height:4px; border-radius:3px; background:var(--border); margin:0 auto 14px; opacity:.8; }
        .note-popup-close-liseuse { position:absolute; top:14px; right:16px; width:28px; height:28px; border:none; background:transparent; color:var(--text-soft); font-size:18px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .note-popup-num-liseuse { font-family:'Cormorant Garamond', serif; font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin-bottom:6px; }
        .note-popup-text-liseuse { font-size:15.5px; line-height:1.7; color:var(--text); overflow-y:auto; text-align:left; hyphens:auto; }

        /* ── Scroll view ── */
        .scroll-view-liseuse {
          flex:1; min-height:0; max-width:1100px; width:100%;
          overflow-y:auto; padding:0; margin:0 auto;
          background: var(--surface);
          box-shadow: 0 0 1px rgba(0,0,0,.08);
        }
        .scroll-inner {
          padding: 48px 64px 80px;
        }
        .scroll-chapter { margin:0 0 56px; }
        .scroll-chapter .col-eyebrow {
          font-family:'Cormorant Garamond', serif; font-size:11px;
          letter-spacing:.22em; text-transform:uppercase; color:var(--accent);
          margin:0 0 4px; opacity:.8;
        }
        .scroll-chapter .col-title {
          font-family:'Cormorant Garamond', serif; font-weight:600;
          font-size: 24px; line-height:1.3; color:var(--text);
          margin:0; padding-bottom:16px; border-bottom:1px solid var(--border);
          margin-bottom:20px;
        }
        .scroll-chapter p {
          font-size:var(--reader-font-size); font-family:var(--reader-font-family);
          line-height:var(--reader-line-height); color:var(--text);
          margin:0 0 1.05em; text-align:justify;
          hyphens:auto; -webkit-hyphens:auto;
          orphans:2; widows:2;
        }

        .iconbtn-liseuse {
          background: var(--surface-2, rgba(0,0,0,0.05));
          border: 1px solid var(--border, rgba(0,0,0,0.12));
          color: var(--text);
          width: 36px;
          height: 36px;
          min-width: 36px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0.85;
          font-size: 15px;
          flex-shrink: 0;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .iconbtn-liseuse:hover { opacity: 1; background: var(--hover, rgba(0,0,0,0.08)); }
        .iconbtn-liseuse.active { opacity: 1; background: var(--accent); color: #fff; border-color: var(--accent); }

        @media (max-width:768px) {
          .col-viewport { padding: 24px 20px 40px; }
          .col-title { font-size: 24px !important; font-weight: 700 !important; }
          .col-chapter p { font-size: 19px !important; line-height: 1.85 !important; }
          .nav-arrow { width: 40px; height: 40px; font-size: 18px; }
          .nav-arrow.left { left: 8px; }
          .nav-arrow.right { right: 8px; }
          .page-footer-overlay { padding: 10px 20px 12px; }
          .progress-wrap { padding: 8px 20px; font-size: 14px; }
          .scroll-inner { padding: 28px 20px 60px; }
          .scroll-chapter .col-title { font-size: 24px !important; font-weight: 700 !important; }
          .toc-drawer { width: 310px; max-width: 85vw; }
        }
        @media (max-width:520px) {
          .col-viewport { padding: 20px 16px 36px; }
          .page-footer-overlay { padding: 8px 16px 10px; }
          .progress-wrap { padding: 6px 16px; }
          .scroll-inner { padding: 20px 16px 48px; }
        }
      `}</style>

      {/* ── TOC Drawer ── */}
      <div className={`toc-overlay ${showToc ? 'open' : ''}`} onClick={() => setShowToc(false)} />
      <div className={`toc-drawer ${showToc ? 'open' : ''}`}>
        <div className="chapter-list-header">
          <div className="chapter-list-title-group">
            <h3 className="sidebar-section-title">📑 Table des matières</h3>
            <span className="chapter-count-badge">{chapters.length}</span>
          </div>
          <button className="sidebar-close-btn" onClick={() => setShowToc(false)} title="Fermer le menu">
            ✕
          </button>
        </div>

        <div className="chapter-items">
          {chapters.map((ch: any, ci: number) => {
            const title = ch.title.includes('—') ? ch.title.split('—')[1]?.trim() : ch.title;
            const chNum = ch.title.match(/chapitre\s*(\d+)/i)?.[1] || `${ci + 1}`;
            return (
              <div
                key={ci}
                className={`chapter-list-item ${ci === currentChapterIndex ? 'active' : ''}`}
                onClick={() => {
                  if (!scrollMode) {
                    const flow = colFlowRef.current;
                    if (flow && colWidthPx > 0) {
                      const chEl = flow.querySelector(`[data-chapter="${ci}"]`) as HTMLElement;
                      if (chEl) {
                        const page = Math.round(chEl.offsetLeft / (colWidthPx + COLUMN_GAP));
                        setCurrentPage(page);
                      }
                    }
                  } else {
                    const chEl = document.querySelector(`.scroll-chapter[data-chapter="${ci}"]`);
                    chEl?.scrollIntoView({ behavior: 'smooth' });
                  }
                  setShowToc(false);
                }}
              >
                <div className="chapter-info">
                  <div className="chapter-title-row">
                    <span className="chapter-number">Ch. {chNum}</span>
                    <span className="chapter-title-text">{title}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="liseuse-wrap">
        <div className="liseuse-topbar">
          <button
            className="chapter-drawer-toggle-btn"
            onClick={() => setShowToc(true)}
            title="Table des matières / Chapitres"
          >
            <span style={{ fontSize: 16 }}>📑</span>
            <span className="toggle-btn-label">Chapitres</span>
          </button>
          <div className="controls">
            {/* Font size quick controls */}
            <div className="font-controls">
              <button className="font-btn font-btn-small" onClick={() => updateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })} title="Réduire la police">A</button>
              <div className="font-divider" />
              <button className="font-btn font-btn-large" onClick={() => updateSettings({ fontSize: Math.min(26, settings.fontSize + 1) })} title="Agrandir la police">A</button>
            </div>
            {/* Settings */}
            <button className="iconbtn-liseuse" onClick={() => setShowSettings(!showSettings)} title="Paramètres de lecture">
              ⚙️
            </button>
            {/* View mode */}
            <button
              className={`iconbtn-liseuse ${scrollMode ? 'active' : ''}`}
              onClick={() => setScrollMode(!scrollMode)}
              title={scrollMode ? 'Vue paginée' : 'Vue continue'}
            >
              {scrollMode ? '📜' : '📖'}
            </button>
          </div>
        </div>

        <div className="reader-main">
          {!scrollMode && (
            <>
              <button className="nav-arrow left" onClick={goPrev} disabled={!canPrev} aria-label="Page précédente">‹</button>
              <button className="nav-arrow right" onClick={goNext} disabled={!canNext} aria-label="Page suivante">›</button>

              <div className="page-frame" onClick={handlePageClick}>
                <div className="col-viewport" ref={viewportRef}>
                  <div
                    ref={colFlowRef}
                    className="col-flow"
                    dangerouslySetInnerHTML={{ __html: allHTML }}
                  />
                </div>
              </div>

              <div className="progress-wrap">
                <span style={{ minWidth: 50 }}>{currentPage + 1} / {totalPages}</span>
                <div className="progress-bar-bg" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setCurrentPage(Math.round(pct * (totalPages - 1)));
                }}>
                  <div className="progress-bar-fill" style={{ width: `${progressPct.toFixed(1)}%` }} />
                </div>
                <span style={{ minWidth: 40, textAlign: 'right' }}>{Math.round(progressPct)}%</span>
              </div>
            </>
          )}

          {scrollMode && (
            <div className="scroll-view-liseuse">
              <div className="scroll-inner">
                {chapters.map((ch: any, ci: number) => {
                  const eyebrow = ch.title.includes('—') ? ch.title.split('—')[0]?.trim() : `Chapitre ${ci + 1}`;
                  const title = ch.title.includes('—') ? ch.title.split('—')[1]?.trim() : ch.title;
                  const hasContent = ch.paragraphs && ch.paragraphs.some((p: string) => p && p.trim().length > 0);
                  let parasHtml = hasContent
                    ? ch.paragraphs.map(renderParagraph).filter(Boolean).join('')
                    : '<p style="font-style: italic; opacity: 0.6;">(Chapitre vide)</p>';
                  if (highlights.length > 0) parasHtml = applyHighlights(parasHtml, highlights);
                  return (
                    <div className="scroll-chapter" key={ci} data-chapter={ci}>
                      <div className="col-eyebrow">{eyebrow}</div>
                      <div className="col-title">{title}</div>
                      <div dangerouslySetInnerHTML={{ __html: parasHtml }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Settings Panel ── */}
      <div className={`settings-overlay ${showSettings ? 'open' : ''}`} onClick={() => setShowSettings(false)} />
      <div className={`settings-panel ${showSettings ? 'open' : ''}`}>
        {/* Theme */}
        <div className="settings-section-title">🎨 Thème de l'application</div>
        <div className="settings-row">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              className={`theme-btn ${theme === t.value ? 'active' : ''}`}
              onClick={() => setTheme(t.value)}
            >
              <div className="theme-preview" style={{ background: t.bg, border: `1px solid ${t.text}22` }} />
              <span className="theme-label">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Font family */}
        <div className="settings-section-title">✒️ Police</div>
        <div className="settings-row">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.value}
              className={`settings-chip ${settings.fontFamily === f.value ? 'active' : ''}`}
              style={{ fontFamily: f.value }}
              onClick={() => updateSettings({ fontFamily: f.value })}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Font size slider */}
        <div className="settings-section-title">🔤 Taille du texte</div>
        <div className="settings-slider-row">
          <span className="settings-slider-label">A</span>
          <input
            type="range"
            className="settings-slider"
            min={14}
            max={26}
            value={settings.fontSize}
            onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
          />
          <span className="settings-slider-value" style={{ fontSize: 18, fontWeight: 600 }}>A</span>
        </div>

        {/* Line height slider */}
        <div className="settings-section-title">↕️ Interligne</div>
        <div className="settings-slider-row">
          <span className="settings-slider-label">{settings.lineHeight.toFixed(1)}</span>
          <input
            type="range"
            className="settings-slider"
            min={1.3}
            max={2.4}
            step={0.1}
            value={settings.lineHeight}
            onChange={(e) => updateSettings({ lineHeight: parseFloat(e.target.value) })}
          />
          <span className="settings-slider-value">{settings.lineHeight.toFixed(1)}</span>
        </div>
      </div>

      {/* ── Highlight popup (on text selection) ── */}
      {selPopup && (
        <div
          className="hl-popup"
          style={{ left: selPopup.x, top: selPopup.y }}
        >
          <span className="hl-popup-label">Surligner</span>
          {HL_COLORS.map((c) => (
            <button
              key={c.name}
              className="hl-color-btn"
              style={{ background: c.value }}
              title={c.name}
              onClick={() => addHighlight(c.value)}
            />
          ))}
        </div>
      )}

      {/* Note popup */}
      <div className={`note-overlay-liseuse ${notePopup ? 'show' : ''}`} onClick={() => setNotePopup(null)} />
      <div className={`note-popup-liseuse ${notePopup ? 'show' : ''}`}>
        <button className="note-popup-close-liseuse" onClick={() => setNotePopup(null)} aria-label="Fermer">×</button>
        {notePopup && (
          <>
            <div className="note-popup-num-liseuse">Note {notePopup.num}</div>
            <div className="note-popup-text-liseuse">{notePopup.text}</div>
          </>
        )}
      </div>
    </>
  );
}
