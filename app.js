const bible = window.BIBLE_DATA;

if (!bible) {
  throw new Error("BIBLE_DATA is not loaded. Check bible-data.js script order.");
}

const state = {
  translation: "kor",
  bookId: "JHN",
  chapter: 3,
  verse: 16,
  fontScale: 1
};

const elements = {
  bookName: document.querySelector("#book-name"),
  reference: document.querySelector("#reference"),
  verseText: document.querySelector("#verse-text"),
  prevButton: document.querySelector("#prev-button"),
  nextButton: document.querySelector("#next-button"),
  smallerButton: document.querySelector("#smaller-button"),
  largerButton: document.querySelector("#larger-button"),
  translationSelect: document.querySelector("#translation-select"),
  bookSelect: document.querySelector("#book-select"),
  chapterSelect: document.querySelector("#chapter-select"),
  verseSelect: document.querySelector("#verse-select"),
  playButton: document.querySelector("#play-button"),
  pauseButton: document.querySelector("#pause-button"),
  stopButton: document.querySelector("#stop-button")
};

Object.entries(elements).forEach(([name, element]) => {
  if (!element) {
    throw new Error(`Missing element: ${name}`);
  }
});

function refKey(ref) {
  return `${ref.bookId}.${ref.chapter}.${ref.verse}`;
}

function getBook(bookId = state.bookId) {
  return bible.books.find((book) => book.id === bookId);
}

function getBookText(bookId = state.bookId, translation = state.translation) {
  return bible.text[translation][bookId];
}

function getChapterVerses(bookId = state.bookId, chapter = state.chapter, translation = state.translation) {
  return getBookText(bookId, translation)[String(chapter)] || [];
}

function hasVerse(translation, ref) {
  return Boolean(getChapterVerses(ref.bookId, ref.chapter, translation)[ref.verse]);
}

function allRefsForTranslation(translation) {
  return bible.books.flatMap((book) =>
    Object.entries(bible.text[translation][book.id]).flatMap(([chapter, verses]) =>
      verses
        .map((text, index) => (text ? { bookId: book.id, chapter: Number(chapter), verse: index } : null))
        .filter(Boolean)
    )
  );
}

const commonRefs = allRefsForTranslation("kor").filter((ref) => hasVerse("web", ref));
const commonRefKeys = new Set(commonRefs.map(refKey));
const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const baseFontSize = 80;
let cachedVoices = [];
let isSpeaking = false;
let speechRunId = 0;
let pendingStopTimer = null;

function getVerseText() {
  return getChapterVerses()[state.verse] || "";
}

function getBookName(book = getBook()) {
  return state.translation === "kor" ? book.koName : book.enName;
}

function referenceForSpeech() {
  return `${getBookName()} ${state.chapter}장 ${state.verse}절`;
}

function availableBooks() {
  const bookIds = new Set(commonRefs.map((ref) => ref.bookId));
  return bible.books.filter((book) => bookIds.has(book.id));
}

function availableChapters(bookId = state.bookId) {
  return [...new Set(commonRefs.filter((ref) => ref.bookId === bookId).map((ref) => ref.chapter))];
}

function availableVerses(bookId = state.bookId, chapter = state.chapter) {
  return commonRefs
    .filter((ref) => ref.bookId === bookId && ref.chapter === chapter)
    .map((ref) => ref.verse);
}

function firstAvailableVerse(bookId = state.bookId, chapter = state.chapter) {
  return availableVerses(bookId, chapter)[0] || 1;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function currentFlatIndex() {
  return commonRefs.findIndex(
    (ref) => ref.bookId === state.bookId && ref.chapter === state.chapter && ref.verse === state.verse
  );
}

function replaceOptions(select, options, selectedValue) {
  select.replaceChildren(
    ...options.map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = label;
      option.selected = String(value) === String(selectedValue);
      return option;
    })
  );
}

function syncSelectors() {
  replaceOptions(
    elements.translationSelect,
    Object.entries(bible.translations).map(([value, info]) => ({ value, label: info.label })),
    state.translation
  );

  replaceOptions(
    elements.bookSelect,
    availableBooks().map((book) => ({
      value: book.id,
      label: state.translation === "kor" ? book.koName : book.enName
    })),
    state.bookId
  );

  replaceOptions(
    elements.chapterSelect,
    availableChapters().map((chapter) => ({ value: chapter, label: `${chapter}장` })),
    state.chapter
  );

  replaceOptions(
    elements.verseSelect,
    availableVerses().map((verse) => ({ value: verse, label: `${verse}절` })),
    state.verse
  );
}

function refreshVoiceCache() {
  cachedVoices = canSpeak ? window.speechSynthesis.getVoices() : [];
}

function preferredVoice() {
  const language = state.translation === "kor" ? "ko-KR" : "en-US";
  return (
    cachedVoices.find((voice) => voice.lang === language) ||
    cachedVoices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase())) ||
    null
  );
}

function clearPendingStop({ cancelNow = false } = {}) {
  if (!pendingStopTimer) {
    return;
  }

  window.clearTimeout(pendingStopTimer);
  pendingStopTimer = null;

  if (cancelNow) {
    window.speechSynthesis.cancel();
  }
}

function stopSpeech() {
  if (!canSpeak) {
    return;
  }

  speechRunId += 1;
  clearPendingStop();

  const wasPaused = window.speechSynthesis.paused;
  isSpeaking = false;

  if (wasPaused) {
    window.speechSynthesis.resume();
    pendingStopTimer = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      pendingStopTimer = null;
    }, 0);
    return;
  }

  window.speechSynthesis.cancel();
}

function buildUtterance(runId) {
  const utterance = new SpeechSynthesisUtterance(`${referenceForSpeech()}. ${getVerseText()}`);
  utterance.lang = state.translation === "kor" ? "ko-KR" : "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.voice = preferredVoice();

  utterance.onstart = () => {
    if (runId === speechRunId) {
      isSpeaking = true;
    }
  };

  utterance.onend = () => {
    if (runId === speechRunId) {
      isSpeaking = false;
    }
  };

  utterance.onerror = () => {
    if (runId === speechRunId) {
      isSpeaking = false;
    }
  };

  return utterance;
}

function playSpeech() {
  if (!canSpeak) {
    return;
  }

  clearPendingStop({ cancelNow: true });

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    isSpeaking = true;
    return;
  }

  if (isSpeaking) {
    stopSpeech();
  }

  speechRunId += 1;
  window.speechSynthesis.speak(buildUtterance(speechRunId));
}

function pauseSpeech() {
  if (!canSpeak || window.speechSynthesis.paused) {
    return;
  }

  window.speechSynthesis.pause();
  isSpeaking = false;
}

function normalizeCurrentReference() {
  const current = { bookId: state.bookId, chapter: state.chapter, verse: state.verse };
  if (commonRefKeys.has(refKey(current))) {
    return;
  }

  const chapters = availableChapters();
  if (!chapters.includes(state.chapter)) {
    state.chapter = chapters[0];
  }

  const verses = availableVerses();
  if (!verses.includes(state.verse)) {
    state.verse = firstAvailableVerse();
  }
}

function renderPassage() {
  normalizeCurrentReference();
  syncSelectors();

  elements.bookName.textContent = getBookName();
  elements.reference.textContent = `${state.chapter}장 ${state.verse}절`;
  elements.verseText.textContent = getVerseText();
  elements.verseText.style.fontSize = `${baseFontSize * state.fontScale}px`;
}

function setReference(ref) {
  stopSpeech();
  state.bookId = ref.bookId;
  state.chapter = ref.chapter;
  state.verse = ref.verse;
  renderPassage();
}

function move(delta) {
  const index = currentFlatIndex();
  const nextIndex = (index + delta + commonRefs.length) % commonRefs.length;
  setReference(commonRefs[nextIndex]);
}

function setFontScale(delta) {
  state.fontScale = clamp(Number((state.fontScale + delta).toFixed(2)), 0.75, 1.45);
  renderPassage();
}

function bindEvents() {
  elements.prevButton.addEventListener("click", () => move(-1));
  elements.nextButton.addEventListener("click", () => move(1));
  elements.smallerButton.addEventListener("click", () => setFontScale(-0.1));
  elements.largerButton.addEventListener("click", () => setFontScale(0.1));

  elements.translationSelect.addEventListener("change", (event) => {
    state.translation = event.target.value;
    renderPassage();
  });

  elements.bookSelect.addEventListener("change", (event) => {
    state.bookId = event.target.value;
    state.chapter = availableChapters()[0];
    state.verse = firstAvailableVerse();
    renderPassage();
  });

  elements.chapterSelect.addEventListener("change", (event) => {
    state.chapter = Number(event.target.value);
    state.verse = firstAvailableVerse();
    renderPassage();
  });

  elements.verseSelect.addEventListener("change", (event) => {
    state.verse = Number(event.target.value);
    renderPassage();
  });

  elements.playButton.addEventListener("click", playSpeech);
  elements.pauseButton.addEventListener("click", pauseSpeech);
  elements.stopButton.addEventListener("click", stopSpeech);

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      move(-1);
    }

    if (event.key === "ArrowRight") {
      move(1);
    }
  });
}

function init() {
  if (!canSpeak) {
    elements.playButton.disabled = true;
    elements.pauseButton.disabled = true;
    elements.stopButton.disabled = true;
  } else {
    refreshVoiceCache();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoiceCache);
  }

  bindEvents();
  renderPassage();
}

init();
