'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { CHAPTERS } from '@/data/chapters';
import { NOTES } from '@/data/notes';
import { useAuth } from '@/components/Auth/AuthProvider';
import { useTheme } from '@/components/Shared/ThemeProvider';
import { getChapters, subscribeToChapters } from '@/services/firebase/firestore';
import { normalizeChapterNotesAndSuperscripts } from '@/hooks/useManuscript';
import { useSpeech } from '@/hooks/useSpeech';
import {
  IconBook,
  IconFolder,
  IconVolume,
  IconPause,
  IconPlay,
  IconStop,
  IconSettings,
  IconClose,
  IconChevronLeft,
  IconChevronRight,
  IconPalette,
  IconFeather,
} from '@/components/Shared/Icons';

const SUP_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

function linkNotes(text: string, chapterNotes: Array<{ key?: string; content: string }> = []): string {
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

const HL_COLORS: { name: string; value: string }[] = [
  { name: 'Jaune', value: '#fef08a' },
  { name: 'Vert', value: '#bbf7d0' },
  { name: 'Bleu', value: '#bfdbfe' },
  { name: 'Rose', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
];

const HL_STORAGE_KEY = 'liseuse-highlights-v1';

function loadHighlights(): Highlight[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HL_STORAGE_KEY) || '[]') as Highlight[];
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
  const sorted = [...highlights].sort((a, b) => b.text.length - a.text.length);
  for (const hl of sorted) {
    const pattern = new RegExp(`(?<=>)([^<]*?)(${escapeRegex(hl.text)})([^<]*?)(?=<)`, 'g');
    result = result.replace(pattern, (_, before, match, after) =>
      `>${before}<mark class="hl" data-hl-id="${hl.id}" style="background:${hl.color};border-radius:2px;padding:0 1px;cursor:pointer">${match}</mark>${after}<`
    );
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

function renderParagraph(raw: string, chapterNotes: Array<{ key?: string; content: string }> = []): string {
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

interface FormattedReaderChapter {
  title: string;
  paragraphs: string[];
  notes: Array<{ key?: string; content: string }>;
}

function buildAllHTML(chapters: FormattedReaderChapter[], highlights: Highlight[]): string {
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
  { label: 'Jour', value: 'day', bg: '#FBFBF9', text: '#1C1B19' },
  { label: 'Sépia', value: 'sepia', bg: '#F5EFEB', text: '#342C24' },
  { label: 'Nuit', value: 'night', bg: '#121211', text: '#F5F4F0' },
];

function loadSettings(): ReaderSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<ReaderSettings>;
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(s: ReaderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

interface RawChapterLike {
  id?: string;
  title?: string;
  blocks?: Array<{ id?: string; content?: string }>;
  paragraphs?: string[];
  notes?: Array<{ key?: string; content: string }>;
}

function formatChaptersForLiseuse(rawChapters: RawChapterLike[]): FormattedReaderChapter[] {
  const editableChapters = rawChapters.map((ch, idx) => ({
    id: ch.id || `ch-${idx}`,
    title: ch.title || `Chapitre ${idx + 1}`,
    blocks: ch.blocks
      ? ch.blocks.map((b, bIdx) => ({
          id: b.id || `b-${bIdx}`,
          content: b.content || '',
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
    notes: (ch.notes || []).map((n, nIdx) => ({
      id: (n as { id?: string }).id || `n-${idx}-${nIdx}`,
      key: n.key || `Note ${nIdx + 1}`,
      content: typeof n === 'string' ? n : n.content,
      source: 'original' as const,
    })),
    pendingReviews: [],
  }));

  const normalized = normalizeChapterNotesAndSuperscripts(editableChapters);
  return normalized.map((ch) => ({
    title: ch.title,
    paragraphs: ch.blocks.map((b) => b.content),
    notes: ch.notes,
  }));
}

function getStoredReaderChapters(currentManuscriptId: string): FormattedReaderChapter[] {
  try {
    if (typeof window !== 'undefined') {
      const keysToScan: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('atelier_manuscript_') || k.startsWith('atelier-manuscrit'))) {
          keysToScan.push(k);
        }
      }
      const explicitKeys = [
        `atelier_manuscript_${currentManuscriptId}`,
        `atelier-manuscrit-v4-${currentManuscriptId}`,
        `atelier-manuscrit-${currentManuscriptId}`,
        'atelier_manuscript_default',
        'atelier-manuscrit-default',
        'atelier-manuscrit-v1',
      ];
      explicitKeys.forEach((k) => {
        if (!keysToScan.includes(k)) keysToScan.push(k);
      });

      let bestParsed: { chapters?: RawChapterLike[]; lastSaved?: number } | null = null;
      for (const k of keysToScan) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const p = JSON.parse(raw) as { chapters?: RawChapterLike[]; lastSaved?: number };
            if (p && p.chapters && Array.isArray(p.chapters) && p.chapters.length > 0) {
              if (!bestParsed || p.chapters.length > (bestParsed.chapters?.length || 0)) {
                bestParsed = p;
              } else if (p.chapters.length === (bestParsed.chapters?.length || 0)) {
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
        const rawChaptersToFormat = bestParsed.chapters.map((c) => ({
          ...c,
          notes: c.notes && c.notes.length > 0 ? c.notes : [],
        }));
        return formatChaptersForLiseuse(rawChaptersToFormat);
      }
    }
  } catch {}

  return formatChaptersForLiseuse(CHAPTERS);
}

export default function LiseusePage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [scrollMode, setScrollMode] = useState(false);
  const [notePopup, setNotePopup] = useState<{ num: string; text: string } | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>(() => loadHighlights());
  const [selPopup, setSelPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings());

  const viewportRef = useRef<HTMLDivElement>(null);
  const colFlowRef = useRef<HTMLDivElement>(null);

  const { user, manuscript } = useAuth();
  const { theme, setTheme } = useTheme();
  const currentManuscriptId = manuscript?.id || 'default';
  const speech = useSpeech();

  const [chapters, setChapters] = useState<FormattedReaderChapter[]>(() =>
    getStoredReaderChapters(currentManuscriptId)
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('atelier-manuscrit')) {
        setChapters(getStoredReaderChapters(currentManuscriptId));
      }
    };

    const handleCustomUpdate = () => {
      setChapters(getStoredReaderChapters(currentManuscriptId));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('atelier_manuscript_updated', handleCustomUpdate);

    let unsub: (() => void) | null = null;

    if (user && manuscript?.id) {
      getChapters(user.uid, manuscript.id)
        .then((fsChapters) => {
          if (fsChapters && fsChapters.length > 0) {
            setChapters(formatChaptersForLiseuse(fsChapters));
          }
        })
        .catch(() => {});

      try {
        unsub = subscribeToChapters(user.uid, manuscript.id, (fsChapters) => {
          if (fsChapters && fsChapters.length > 0) {
            setChapters(formatChaptersForLiseuse(fsChapters));
          }
        });
      } catch {}
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('atelier_manuscript_updated', handleCustomUpdate);
      if (unsub) unsub();
    };
  }, [currentManuscriptId, user, manuscript?.id]);

  const updateSettings = (patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const allHTML = buildAllHTML(chapters, highlights);

  const measurePages = useCallback(() => {
    const vp = viewportRef.current;
    const flow = colFlowRef.current;
    if (!vp || !flow) return;

    const vpStyle = getComputedStyle(vp);
    const padL = parseFloat(vpStyle.paddingLeft);
    const padR = parseFloat(vpStyle.paddingRight);
    const colWidth = vp.getBoundingClientRect().width - padL - padR;
    if (colWidth <= 0) return;

    flow.style.columnWidth = `${colWidth}px`;
    flow.style.transform = 'none';

    void flow.offsetHeight;
    const sw = flow.scrollWidth;
    const total = Math.max(1, Math.round((sw + COLUMN_GAP) / (colWidth + COLUMN_GAP)));

    const page = Math.min(currentPage, total - 1);
    flow.style.transform = `translateX(${-page * (colWidth + COLUMN_GAP)}px)`;

    setTotalPages(total);
    if (page !== currentPage) setCurrentPage(page);

    // Calculate current chapter index
    const offset = page * (colWidth + COLUMN_GAP);
    const chList = flow.querySelectorAll('.col-chapter');
    let lastCI = 0;
    chList.forEach((ch) => {
      const el = ch as HTMLElement;
      if (el.offsetLeft <= offset + colWidth / 2) {
        lastCI = parseInt(el.dataset.chapter || '0', 10);
      }
    });
    setCurrentChapterIndex(lastCI);
  }, [currentPage]);

  useLayoutEffect(() => {
    if (scrollMode) return;
    measurePages();
  }, [scrollMode, measurePages, settings, chapters, highlights]);

  useEffect(() => {
    const handler = () => {
      if (!scrollMode) measurePages();
    };
    window.addEventListener('resize', handler);
    document.fonts?.ready?.then(() => setTimeout(handler, 50));
    return () => window.removeEventListener('resize', handler);
  }, [scrollMode, measurePages]);

  const goNext = useCallback(() => {
    setCurrentPage((p) => (p >= totalPages - 1 ? p : p + 1));
  }, [totalPages]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => (p <= 0 ? p : p - 1));
  }, []);

  const getNoteContentFromRef = useCallback((refEl: HTMLElement): { num: string; text: string } | null => {
    const num = refEl.dataset.note || '';
    if (!num) return null;

    const chapterCol = refEl.closest('.col-chapter') as HTMLElement | null;
    const chIndexStr = chapterCol?.dataset.chapter;
    const chIndex = chIndexStr !== undefined ? parseInt(chIndexStr, 10) : -1;

    let noteText: string | undefined;

    if (chIndex >= 0 && chapters && chapters[chIndex]) {
      const ch = chapters[chIndex];
      if (ch.notes && Array.isArray(ch.notes) && ch.notes.length > 0) {
        const noteIdx = parseInt(num, 10) - 1;
        const found = ch.notes.find((n, idx) => {
          const nNum = n.key ? String(n.key).replace(/\D/g, '') || String(idx + 1) : String(idx + 1);
          return nNum === num || idx === noteIdx;
        }) || ch.notes[noteIdx];

        if (found) {
          noteText = typeof found === 'string' ? found : found.content;
        }
      }
    }

    if (!noteText && chIndex === -1 && chapters) {
      for (const ch of chapters) {
        if (ch.notes && Array.isArray(ch.notes) && ch.notes.length > 0) {
          const noteIdx = parseInt(num, 10) - 1;
          const found = ch.notes.find((n, idx) => {
            const nNum = n.key ? String(n.key).replace(/\D/g, '') || String(idx + 1) : String(idx + 1);
            return nNum === num || idx === noteIdx;
          }) || ch.notes[noteIdx];

          if (found) {
            noteText = typeof found === 'string' ? found : found.content;
            break;
          }
        }
      }
    }

    return noteText ? { num, text: noteText } : null;
  }, [chapters]);

  // Keyboard navigation
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
      if (e.key === 'ArrowRight' || (e.key === ' ' && !activeEl?.classList.contains('note-ref'))) {
        e.preventDefault();
        goNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'Escape') {
        setNotePopup(null);
        setSelPopup(null);
      }
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
    const onStart = (e: TouchEvent) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      active = true;
    };
    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) goNext();
        else goPrev();
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [scrollMode, goNext, goPrev]);

  // Text Selection -> Highlight popup
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          return;
        }
        const text = sel.toString().trim();
        if (text.length < 3) return;

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

  useEffect(() => {
    if (!selPopup) return;
    const dismiss = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.hl-popup')) return;
      setSelPopup(null);
    };
    setTimeout(() => document.addEventListener('mousedown', dismiss), 50);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [selPopup]);

  const addHighlight = useCallback((color: string) => {
    if (!selPopup) return;
    const newHL: Highlight = {
      id: `hl-${Date.now()}-${highlights.length + 1}`,
      text: selPopup.text,
      color,
    };
    const updated = [...highlights, newHL];
    setHighlights(updated);
    saveHighlights(updated);
    setSelPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [selPopup, highlights]);

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

  const handlePageClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.note-ref')) return;
    if ((e.target as HTMLElement).closest('mark.hl')) return;
    if (window.getSelection()?.toString().trim()) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    if (xPct < 0.3) goPrev();
    else if (xPct > 0.7) goNext();
  };

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

  const handleToggleSpeech = useCallback(() => {
    if (speech.isPlaying) {
      if (speech.isPaused) {
        speech.resume();
      } else {
        speech.pause();
      }
    } else {
      const activeCh = chapters[currentChapterIndex] || chapters[0];
      if (activeCh && activeCh.paragraphs) {
        const title = activeCh.title || '';
        const body = activeCh.paragraphs.join('\n\n');
        speech.speak(`${title}.\n\n${body}`);
      }
    }
  }, [speech, chapters, currentChapterIndex]);

  const progressPct = totalPages > 1 ? ((currentPage + 1) / totalPages) * 100 : 100;
  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1;

  return (
    <div
      className="liseuse-wrap"
      style={{
        ['--reader-font-size' as string]: `${settings.fontSize}px`,
        ['--reader-font-family' as string]: settings.fontFamily,
        ['--reader-line-height' as string]: settings.lineHeight,
      }}
    >
      {/* ── TOC Drawer ── */}
      <div
        className={`toc-overlay ${showToc ? 'open' : ''}`}
        onClick={() => setShowToc(false)}
      />
      <div className={`toc-drawer ${showToc ? 'open' : ''}`}>
        <div className="chapter-list-header">
          <div className="chapter-list-title-group">
            <IconFolder size={17} strokeWidth={2} />
            <h3 className="sidebar-section-title">Table des matières</h3>
            <span className="chapter-count-badge">{chapters.length}</span>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={() => setShowToc(false)}
            title="Fermer le menu"
            aria-label="Fermer"
          >
            <IconClose size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="chapter-items">
          {chapters.map((ch, ci) => {
            const title = ch.title.includes('—') ? ch.title.split('—')[1]?.trim() : ch.title;
            const chNum = ch.title.match(/chapitre\s*(\d+)/i)?.[1] || `${ci + 1}`;
            return (
              <div
                key={ci}
                className={`chapter-list-item ${ci === currentChapterIndex ? 'active' : ''}`}
                onClick={() => {
                  if (!scrollMode) {
                    const flow = colFlowRef.current;
                    const vp = viewportRef.current;
                    if (flow && vp) {
                      const chEl = flow.querySelector(`[data-chapter="${ci}"]`) as HTMLElement;
                      const colWidth = vp.getBoundingClientRect().width - 128;
                      if (chEl && colWidth > 0) {
                        const page = Math.round(chEl.offsetLeft / (colWidth + COLUMN_GAP));
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

      {/* ── Topbar ── */}
      <div className="liseuse-topbar">
        <button
          className="chapter-drawer-toggle-btn"
          onClick={() => setShowToc(true)}
          title="Table des matières / Chapitres"
        >
          <IconFolder size={16} strokeWidth={2} />
          <span className="toggle-btn-label">Chapitres</span>
        </button>

        <div className="controls">
          {/* Font size quick controls */}
          <div className="font-controls">
            <button
              className="font-btn font-btn-small"
              onClick={() => updateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
              title="Réduire la police"
            >
              A
            </button>
            <div className="font-divider" />
            <button
              className="font-btn font-btn-large"
              onClick={() => updateSettings({ fontSize: Math.min(26, settings.fontSize + 1) })}
              title="Agrandir la police"
            >
              A
            </button>
          </div>

          {/* Audio playback / Audiobook Speech Synthesis */}
          <button
            className={`iconbtn-liseuse ${speech.isPlaying ? 'active' : ''}`}
            onClick={handleToggleSpeech}
            title={
              speech.isPlaying
                ? speech.isPaused
                  ? 'Reprendre la lecture audio'
                  : 'Mettre en pause la lecture'
                : 'Écouter le chapitre actuel'
            }
            aria-label="Lecture audio"
          >
            {speech.isPlaying ? (
              speech.isPaused ? (
                <IconPlay size={16} strokeWidth={2} />
              ) : (
                <IconPause size={16} strokeWidth={2} />
              )
            ) : (
              <IconVolume size={16} strokeWidth={2} />
            )}
          </button>
          {speech.isPlaying && (
            <button
              className="iconbtn-liseuse btn-danger-icon"
              onClick={speech.stop}
              title="Arrêter la lecture audio"
              aria-label="Arrêter la lecture"
            >
              <IconStop size={15} strokeWidth={2} />
            </button>
          )}

          {/* Settings */}
          <button
            className="iconbtn-liseuse"
            onClick={() => setShowSettings(!showSettings)}
            title="Paramètres de lecture"
            aria-label="Paramètres"
          >
            <IconSettings size={16} strokeWidth={2} />
          </button>

          {/* View mode */}
          <button
            className={`iconbtn-liseuse ${scrollMode ? 'active' : ''}`}
            onClick={() => setScrollMode(!scrollMode)}
            title={scrollMode ? 'Vue paginée' : 'Vue continue'}
            aria-label="Changer le mode de défilement"
          >
            <IconBook size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="reader-main">
        {!scrollMode && (
          <>
            <button
              className="nav-arrow left"
              onClick={goPrev}
              disabled={!canPrev}
              aria-label="Page précédente"
            >
              <IconChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button
              className="nav-arrow right"
              onClick={goNext}
              disabled={!canNext}
              aria-label="Page suivante"
            >
              <IconChevronRight size={20} strokeWidth={2.5} />
            </button>

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
              <span className="progress-pages">
                {currentPage + 1} / {totalPages}
              </span>
              <div
                className="progress-track"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setCurrentPage(Math.round(pct * (totalPages - 1)));
                }}
              >
                <div className="progress-fill" style={{ width: `${progressPct.toFixed(1)}%` }} />
              </div>
              <span className="progress-pct">{Math.round(progressPct)}%</span>
            </div>
          </>
        )}

        {scrollMode && (
          <div className="scroll-view-liseuse">
            <div className="scroll-inner">
              {chapters.map((ch, ci) => {
                const eyebrow = ch.title.includes('—') ? ch.title.split('—')[0]?.trim() : `Chapitre ${ci + 1}`;
                const title = ch.title.includes('—') ? ch.title.split('—')[1]?.trim() : ch.title;
                const hasContent = ch.paragraphs && ch.paragraphs.some((p: string) => p && p.trim().length > 0);
                let parasHtml = hasContent
                  ? ch.paragraphs.map((p) => renderParagraph(p, ch.notes)).filter(Boolean).join('')
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

      {/* ── Settings Panel ── */}
      <div
        className={`settings-overlay ${showSettings ? 'open' : ''}`}
        onClick={() => setShowSettings(false)}
      />
      <div className={`settings-panel ${showSettings ? 'open' : ''}`}>
        {/* Theme */}
        <div className="settings-section-title">
          <IconPalette size={15} strokeWidth={2} />
          <span>Thème de l&apos;application</span>
        </div>
        <div className="settings-row">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              className={`theme-btn ${theme === t.value ? 'active' : ''}`}
              onClick={() => setTheme(t.value)}
            >
              <div
                className="theme-preview"
                style={{ background: t.bg, border: `1px solid ${t.text}22` }}
              />
              <span className="theme-label">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Font family */}
        <div className="settings-section-title">
          <IconFeather size={15} strokeWidth={2} />
          <span>Police d&apos;écriture</span>
        </div>
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
        <div className="settings-section-title">
          <span>Taille du texte ({settings.fontSize}px)</span>
        </div>
        <div className="settings-slider-row">
          <span className="settings-slider-label">A</span>
          <input
            type="range"
            className="settings-slider"
            min={14}
            max={26}
            value={settings.fontSize}
            onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value, 10) })}
          />
          <span className="settings-slider-value" style={{ fontSize: 18, fontWeight: 600 }}>
            A
          </span>
        </div>

        {/* Line height slider */}
        <div className="settings-section-title">
          <span>Interligne ({settings.lineHeight.toFixed(2)})</span>
        </div>
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
        <div className="hl-popup" style={{ left: selPopup.x, top: selPopup.y }}>
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
      <div
        className={`note-overlay-liseuse ${notePopup ? 'show' : ''}`}
        onClick={() => setNotePopup(null)}
      />
      <div className={`note-popup-liseuse ${notePopup ? 'show' : ''}`}>
        <button
          className="note-popup-close-liseuse"
          onClick={() => setNotePopup(null)}
          aria-label="Fermer"
        >
          <IconClose size={15} strokeWidth={2} />
        </button>
        {notePopup && (
          <>
            <div className="note-popup-num-liseuse">Note {notePopup.num}</div>
            <div className="note-popup-text-liseuse">{notePopup.text}</div>
          </>
        )}
      </div>
    </div>
  );
}
