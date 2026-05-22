const bible = window.BIBLE_DATA;

if (!bible) {
  throw new Error("BIBLE_DATA is not loaded. Check bible-data.js script order.");
}

const defaultLocation = { bookId: "GEN", chapter: "1", verse: "1" };

const state = {
  version: "kor",
  bookId: defaultLocation.bookId,
  chapter: defaultLocation.chapter,
  verse: defaultLocation.verse,
  fontScale: 0.75
};

const savedLocationsByVersion = Object.fromEntries(
  Object.keys(bible.versions).map((version) => [version, { ...defaultLocation }])
);

const elements = {
  bookName: document.querySelector("#book-name"),
  reference: document.querySelector("#reference"),
  passageRegion: document.querySelector("#passage-region"),
  verseText: document.querySelector("#verse-text"),
  prevButton: document.querySelector("#prev-button"),
  nextButton: document.querySelector("#next-button"),
  smallerButton: document.querySelector("#smaller-button"),
  largerButton: document.querySelector("#larger-button"),
  versionSelect: document.querySelector("#version-select"),
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

function currentVersion() {
  return bible.versions[state.version];
}

function isKoreanVersion() {
  return currentVersion().language === "ko";
}

function getBook(bookId = state.bookId) {
  return bible.books.find((book) => book.id === bookId);
}

function getBookText(bookId = state.bookId, version = state.version) {
  return bible.text[version][bookId];
}

function getChapterVerses(bookId = state.bookId, chapter = state.chapter, version = state.version) {
  return getBookText(bookId, version)[String(chapter)] || [];
}

function getVerseEntry(bookId = state.bookId, chapter = state.chapter, verse = state.verse, version = state.version) {
  return getChapterVerses(bookId, chapter, version).find((entry) => entry.number === String(verse)) || null;
}

function hasVerse(version, ref) {
  return Boolean(getVerseEntry(ref.bookId, ref.chapter, ref.verse, version));
}

function allRefsForVersion(version) {
  return bible.books.flatMap((book) =>
    Object.entries(bible.text[version][book.id]).flatMap(([chapter, verses]) =>
      verses.map((entry) => ({ bookId: book.id, chapter, verse: entry.number }))
    )
  );
}

const refsByVersion = Object.fromEntries(
  Object.keys(bible.versions).map((version) => [version, allRefsForVersion(version)])
);
const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const baseFontSize = 80;
let cachedVoices = [];
let speechRunId = 0;
let pendingStopTimer = null;
let isPausedByUser = false;

function getVerseText() {
  return getVerseEntry()?.text || "";
}

function getBookName(book = getBook()) {
  return isKoreanVersion() ? book.koName : book.enName;
}

const sinoKoreanDigits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const sinoKoreanUnits = [
  { value: 1000, label: "천" },
  { value: 100, label: "백" },
  { value: 10, label: "십" }
];

function numberToSinoKorean(value) {
  if (!/^\d+$/.test(String(value))) {
    return String(value);
  }

  let remaining = Number(value);

  if (!Number.isInteger(remaining) || remaining <= 0 || remaining >= 10000) {
    return String(value);
  }

  let spoken = "";

  sinoKoreanUnits.forEach(({ value: unitValue, label }) => {
    const digit = Math.floor(remaining / unitValue);
    if (digit > 0) {
      spoken += `${digit > 1 ? sinoKoreanDigits[digit] : ""}${label}`;
      remaining %= unitValue;
    }
  });

  return `${spoken}${sinoKoreanDigits[remaining]}`;
}

function referenceForDisplay() {
  if (!isKoreanVersion()) {
    return `Chapter ${state.chapter} Verse ${state.verse}`;
  }

  return `${state.chapter}장 ${state.verse}절`;
}

function chapterLabel(chapter) {
  return isKoreanVersion() ? `${chapter}장` : `Chapter ${chapter}`;
}

function verseLabel(verse) {
  return isKoreanVersion() ? `${verse}절` : `Verse ${verse}`;
}

function referenceForSpeech() {
  if (!isKoreanVersion()) {
    return `${getBookName()} chapter ${state.chapter} verse ${state.verse}`;
  }

  return `${getBookName()} ${numberToSinoKorean(state.chapter)} 장 ${numberToSinoKorean(state.verse)} 절`;
}

function refsForVersion(version = state.version) {
  return refsByVersion[version] || [];
}

function availableBooks() {
  const bookIds = new Set(refsForVersion().map((ref) => ref.bookId));
  return bible.books.filter((book) => bookIds.has(book.id));
}

function availableChapters(bookId = state.bookId) {
  return [...new Set(refsForVersion().filter((ref) => ref.bookId === bookId).map((ref) => ref.chapter))];
}

function availableVerses(bookId = state.bookId, chapter = state.chapter) {
  return refsForVersion()
    .filter((ref) => ref.bookId === bookId && ref.chapter === String(chapter))
    .map((ref) => ref.verse);
}

function firstAvailableVerse(bookId = state.bookId, chapter = state.chapter) {
  return availableVerses(bookId, chapter)[0] || "1";
}

function firstReferenceForVersion(version = state.version) {
  return refsForVersion(version)[0];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function currentFlatIndex() {
  return refsForVersion().findIndex(
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
    elements.versionSelect,
    Object.entries(bible.versions).map(([value, info]) => ({ value, label: info.label })),
    state.version
  );

  replaceOptions(
    elements.bookSelect,
    availableBooks().map((book) => ({
      value: book.id,
      label: isKoreanVersion() ? book.koName : book.enName
    })),
    state.bookId
  );

  replaceOptions(
    elements.chapterSelect,
    availableChapters().map((chapter) => ({ value: chapter, label: chapterLabel(chapter) })),
    state.chapter
  );

  replaceOptions(
    elements.verseSelect,
    availableVerses().map((verse) => ({ value: verse, label: verseLabel(verse) })),
    state.verse
  );

  const chapterAriaLabel = isKoreanVersion() ? "장 선택" : "Chapter selection";
  const verseAriaLabel = isKoreanVersion() ? "절 선택" : "Verse selection";
  elements.chapterSelect.setAttribute("aria-label", chapterAriaLabel);
  elements.verseSelect.setAttribute("aria-label", verseAriaLabel);
}

function refreshVoiceCache() {
  cachedVoices = canSpeak ? window.speechSynthesis.getVoices() : [];
}

function preferredVoice() {
  const language = currentVersion().language === "ko" ? "ko-KR" : "en-US";
  return (
    cachedVoices.find((voice) => voice.lang === language) ||
    cachedVoices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase())) ||
    null
  );
}

function hasSpeechQueue() {
  return window.speechSynthesis.speaking || window.speechSynthesis.pending;
}

function clearPendingStop() {
  if (!pendingStopTimer) {
    return;
  }

  window.clearTimeout(pendingStopTimer);
  pendingStopTimer = null;
}

function cancelSpeechQueue({ confirmCancel = false } = {}) {
  if (!canSpeak) {
    return;
  }

  speechRunId += 1;
  clearPendingStop();
  isPausedByUser = false;

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  window.speechSynthesis.cancel();

  if (confirmCancel) {
    pendingStopTimer = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      pendingStopTimer = null;
    }, 0);
  }
}

function stopSpeech() {
  cancelSpeechQueue({ confirmCancel: true });
}

function buildUtterance(runId) {
  const utterance = new SpeechSynthesisUtterance(`${referenceForSpeech()}. ${getVerseText()}`);
  utterance.lang = currentVersion().language === "ko" ? "ko-KR" : "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.voice = preferredVoice();

  utterance.onend = () => {
    if (runId === speechRunId) {
      isPausedByUser = false;
      clearPendingStop();
    }
  };

  utterance.onerror = () => {
    if (runId === speechRunId) {
      isPausedByUser = false;
      clearPendingStop();
    }
  };

  return utterance;
}

function startSpeech() {
  speechRunId += 1;
  window.speechSynthesis.speak(buildUtterance(speechRunId));
}

function playSpeech() {
  if (!canSpeak) {
    return;
  }

  clearPendingStop();

  if (isPausedByUser) {
    isPausedByUser = false;
    if (window.speechSynthesis.paused || hasSpeechQueue()) {
      window.speechSynthesis.resume();
      return;
    }
  }

  if (hasSpeechQueue()) {
    cancelSpeechQueue();
    pendingStopTimer = window.setTimeout(() => {
      pendingStopTimer = null;
      startSpeech();
    }, 0);
    return;
  }

  startSpeech();
}

function pauseSpeech() {
  if (!canSpeak || window.speechSynthesis.paused || !hasSpeechQueue()) {
    return;
  }

  window.speechSynthesis.pause();
  isPausedByUser = true;
}

function saveCurrentLocation() {
  savedLocationsByVersion[state.version] = {
    bookId: state.bookId,
    chapter: state.chapter,
    verse: state.verse
  };
}

function restoreLocationForVersion(version) {
  const saved = savedLocationsByVersion[version] || firstReferenceForVersion(version);
  state.bookId = saved.bookId;
  state.chapter = String(saved.chapter);
  state.verse = String(saved.verse);
}

function normalizeCurrentReference() {
  const current = { bookId: state.bookId, chapter: state.chapter, verse: state.verse };
  if (hasVerse(state.version, current)) {
    return;
  }

  const chapters = availableChapters();
  if (!chapters.length) {
    const firstRef = firstReferenceForVersion();
    state.bookId = firstRef.bookId;
    state.chapter = firstRef.chapter;
    state.verse = firstRef.verse;
    return;
  }

  if (!chapters.includes(state.chapter)) {
    state.chapter = chapters[0];
  }

  const verses = availableVerses();
  if (!verses.includes(state.verse)) {
    state.verse = firstAvailableVerse();
  }
}

function syncPassageLanguage() {
  const language = currentVersion().language;
  elements.passageRegion.lang = language;
  elements.bookName.lang = language;
  elements.reference.lang = language;
  elements.verseText.lang = language;
}

function renderPassage() {
  normalizeCurrentReference();
  syncSelectors();
  syncPassageLanguage();

  elements.bookName.textContent = getBookName();
  elements.reference.textContent = referenceForDisplay();
  elements.verseText.textContent = getVerseText();
  elements.verseText.style.fontSize = `${baseFontSize * state.fontScale}px`;
}

function setReference(ref) {
  cancelSpeechQueue({ confirmCancel: true });
  state.bookId = ref.bookId;
  state.chapter = String(ref.chapter);
  state.verse = String(ref.verse);
  saveCurrentLocation();
  renderPassage();
}

function move(delta) {
  const refs = refsForVersion();
  const index = Math.max(currentFlatIndex(), 0);
  const nextIndex = (index + delta + refs.length) % refs.length;
  setReference(refs[nextIndex]);
}

function setFontScale(delta) {
  state.fontScale = clamp(Number((state.fontScale + delta).toFixed(2)), 0.75, 1.45);
  renderPassage();
}

function shouldIgnoreGlobalShortcut(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
}

function bindEvents() {
  elements.prevButton.addEventListener("click", () => move(-1));
  elements.nextButton.addEventListener("click", () => move(1));
  elements.smallerButton.addEventListener("click", () => setFontScale(-0.1));
  elements.largerButton.addEventListener("click", () => setFontScale(0.1));

  elements.versionSelect.addEventListener("change", (event) => {
    cancelSpeechQueue({ confirmCancel: true });
    saveCurrentLocation();
    state.version = event.target.value;
    restoreLocationForVersion(state.version);
    renderPassage();
  });

  elements.bookSelect.addEventListener("change", (event) => {
    cancelSpeechQueue({ confirmCancel: true });
    state.bookId = event.target.value;
    state.chapter = availableChapters()[0];
    state.verse = firstAvailableVerse();
    saveCurrentLocation();
    renderPassage();
  });

  elements.chapterSelect.addEventListener("change", (event) => {
    cancelSpeechQueue({ confirmCancel: true });
    state.chapter = event.target.value;
    state.verse = firstAvailableVerse();
    saveCurrentLocation();
    renderPassage();
  });

  elements.verseSelect.addEventListener("change", (event) => {
    cancelSpeechQueue({ confirmCancel: true });
    state.verse = event.target.value;
    saveCurrentLocation();
    renderPassage();
  });

  elements.playButton.addEventListener("click", playSpeech);
  elements.pauseButton.addEventListener("click", pauseSpeech);
  elements.stopButton.addEventListener("click", stopSpeech);

  window.addEventListener("keydown", (event) => {
    if (shouldIgnoreGlobalShortcut(event)) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
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
