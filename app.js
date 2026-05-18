const bible = window.BIBLE_DATA;

if (!bible) {
  throw new Error("BIBLE_DATA is not loaded. Check bible-data.js script order.");
}

const state = {
  translation: "kor",
  bookId: "JHN",
  chapter: 3,
  verse: 16,
  fontScale: 1,
  theme: "light",
  lineHeight: "normal",
  textWidth: "comfortable",
  letterSpacing: "normal",
  speechRate: 1,
  isSpeaking: false
};

const elements = {
  reference: document.querySelector("#reference"),
  progress: document.querySelector("#progress"),
  progressBar: document.querySelector("#progress-bar"),
  verseText: document.querySelector("#verse-text"),
  prevButton: document.querySelector("#prev-button"),
  nextButton: document.querySelector("#next-button"),
  smallerButton: document.querySelector("#smaller-button"),
  largerButton: document.querySelector("#larger-button"),
  settingsButton: document.querySelector("#settings-button"),
  settingsPanel: document.querySelector("#settings-panel"),
  translationSelect: document.querySelector("#translation-select"),
  bookSelect: document.querySelector("#book-select"),
  chapterSelect: document.querySelector("#chapter-select"),
  verseSelect: document.querySelector("#verse-select"),
  themeSelect: document.querySelector("#theme-select"),
  lineHeightSelect: document.querySelector("#line-height-select"),
  textWidthSelect: document.querySelector("#text-width-select"),
  letterSpacingSelect: document.querySelector("#letter-spacing-select"),
  speechRateSelect: document.querySelector("#speech-rate-select"),
  speakButton: document.querySelector("#speak-button"),
  stopSpeechButton: document.querySelector("#stop-speech-button"),
  speechStatus: document.querySelector("#speech-status")
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
let cachedVoices = [];

function getVerseText() {
  return getChapterVerses()[state.verse] || "";
}

function getBookName(book = getBook()) {
  return state.translation === "kor" ? book.koName : book.enName;
}

function referenceFor() {
  return `${getBookName()} ${state.chapter}:${state.verse}`;
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

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function currentFlatIndex(refs = commonRefs) {
  return refs.findIndex(
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

function syncReadingSettings() {
  document.body.dataset.theme = state.theme;
  document.body.dataset.lineHeight = state.lineHeight;
  document.body.dataset.textWidth = state.textWidth;
  document.body.dataset.letterSpacing = state.letterSpacing;

  elements.themeSelect.value = state.theme;
  elements.lineHeightSelect.value = state.lineHeight;
  elements.textWidthSelect.value = state.textWidth;
  elements.letterSpacingSelect.value = state.letterSpacing;
  elements.speechRateSelect.value = String(state.speechRate);
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

function stopSpeech() {
  if (!canSpeak) {
    return;
  }

  window.speechSynthesis.cancel();
  state.isSpeaking = false;
  elements.speakButton.textContent = "현재 절 읽기";
  elements.speechStatus.textContent = "읽기 중지됨";
}

function speakCurrentVerse() {
  if (!canSpeak) {
    elements.speechStatus.textContent = "이 브라우저는 음성 읽기를 지원하지 않습니다.";
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(`${referenceFor()}. ${getVerseText()}`);
  utterance.lang = state.translation === "kor" ? "ko-KR" : "en-US";
  utterance.rate = state.speechRate;
  utterance.pitch = 1;
  utterance.voice = preferredVoice();

  utterance.onstart = () => {
    state.isSpeaking = true;
    elements.speakButton.textContent = "다시 읽기";
    elements.speechStatus.textContent = "읽는 중";
  };

  utterance.onend = () => {
    state.isSpeaking = false;
    elements.speakButton.textContent = "현재 절 읽기";
    elements.speechStatus.textContent = "읽기 완료";
  };

  utterance.onerror = () => {
    state.isSpeaking = false;
    elements.speakButton.textContent = "현재 절 읽기";
    elements.speechStatus.textContent = "음성 읽기를 시작하지 못했습니다.";
  };

  window.speechSynthesis.speak(utterance);
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
  syncReadingSettings();

  const index = currentFlatIndex();
  const current = index + 1;
  const total = commonRefs.length;
  const percent = ((current / total) * 100).toFixed(2);

  elements.reference.textContent = referenceFor();
  elements.progress.textContent = `${formatNumber(current)} / ${formatNumber(total)} · ${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
  elements.verseText.textContent = getVerseText();

  document.documentElement.style.setProperty("--reader-scale", state.fontScale);
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

function toggleSettingsPanel() {
  const isOpen = elements.settingsPanel.hidden;
  elements.settingsPanel.hidden = !isOpen;
  elements.settingsButton.setAttribute("aria-expanded", String(isOpen));
}

function bindEvents() {
  elements.prevButton.addEventListener("click", () => move(-1));
  elements.nextButton.addEventListener("click", () => move(1));
  elements.smallerButton.addEventListener("click", () => setFontScale(-0.1));
  elements.largerButton.addEventListener("click", () => setFontScale(0.1));
  elements.settingsButton.addEventListener("click", toggleSettingsPanel);

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

  elements.themeSelect.addEventListener("change", (event) => {
    state.theme = event.target.value;
    renderPassage();
  });

  elements.lineHeightSelect.addEventListener("change", (event) => {
    state.lineHeight = event.target.value;
    renderPassage();
  });

  elements.textWidthSelect.addEventListener("change", (event) => {
    state.textWidth = event.target.value;
    renderPassage();
  });

  elements.letterSpacingSelect.addEventListener("change", (event) => {
    state.letterSpacing = event.target.value;
    renderPassage();
  });

  elements.speechRateSelect.addEventListener("change", (event) => {
    state.speechRate = Number(event.target.value);
    renderPassage();
  });

  elements.speakButton.addEventListener("click", speakCurrentVerse);
  elements.stopSpeechButton.addEventListener("click", stopSpeech);

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
    elements.speakButton.disabled = true;
    elements.stopSpeechButton.disabled = true;
    elements.speechStatus.textContent = "이 브라우저는 음성 읽기를 지원하지 않습니다.";
  } else {
    refreshVoiceCache();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoiceCache);
  }

  bindEvents();
  renderPassage();
}

init();
