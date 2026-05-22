const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const canonicalBooks = [
  ["GEN", "창세기", "Genesis"],
  ["EXO", "출애굽기", "Exodus"],
  ["LEV", "레위기", "Leviticus"],
  ["NUM", "민수기", "Numbers"],
  ["DEU", "신명기", "Deuteronomy"],
  ["JOS", "여호수아", "Joshua"],
  ["JDG", "사사기", "Judges"],
  ["RUT", "룻기", "Ruth"],
  ["1SA", "사무엘상", "1 Samuel"],
  ["2SA", "사무엘하", "2 Samuel"],
  ["1KI", "열왕기상", "1 Kings"],
  ["2KI", "열왕기하", "2 Kings"],
  ["1CH", "역대상", "1 Chronicles"],
  ["2CH", "역대하", "2 Chronicles"],
  ["EZR", "에스라", "Ezra"],
  ["NEH", "느헤미야", "Nehemiah"],
  ["EST", "에스더", "Esther"],
  ["JOB", "욥기", "Job"],
  ["PSA", "시편", "Psalms"],
  ["PRO", "잠언", "Proverbs"],
  ["ECC", "전도서", "Ecclesiastes"],
  ["SNG", "아가", "Song of Songs"],
  ["ISA", "이사야", "Isaiah"],
  ["JER", "예레미야", "Jeremiah"],
  ["LAM", "예레미야애가", "Lamentations"],
  ["EZK", "에스겔", "Ezekiel"],
  ["DAN", "다니엘", "Daniel"],
  ["HOS", "호세아", "Hosea"],
  ["JOL", "요엘", "Joel"],
  ["AMO", "아모스", "Amos"],
  ["OBA", "오바댜", "Obadiah"],
  ["JON", "요나", "Jonah"],
  ["MIC", "미가", "Micah"],
  ["NAM", "나훔", "Nahum"],
  ["HAB", "하박국", "Habakkuk"],
  ["ZEP", "스바냐", "Zephaniah"],
  ["HAG", "학개", "Haggai"],
  ["ZEC", "스가랴", "Zechariah"],
  ["MAL", "말라기", "Malachi"],
  ["MAT", "마태복음", "Matthew"],
  ["MRK", "마가복음", "Mark"],
  ["LUK", "누가복음", "Luke"],
  ["JHN", "요한복음", "John"],
  ["ACT", "사도행전", "Acts"],
  ["ROM", "로마서", "Romans"],
  ["1CO", "고린도전서", "1 Corinthians"],
  ["2CO", "고린도후서", "2 Corinthians"],
  ["GAL", "갈라디아서", "Galatians"],
  ["EPH", "에베소서", "Ephesians"],
  ["PHP", "빌립보서", "Philippians"],
  ["COL", "골로새서", "Colossians"],
  ["1TH", "데살로니가전서", "1 Thessalonians"],
  ["2TH", "데살로니가후서", "2 Thessalonians"],
  ["1TI", "디모데전서", "1 Timothy"],
  ["2TI", "디모데후서", "2 Timothy"],
  ["TIT", "디도서", "Titus"],
  ["PHM", "빌레몬서", "Philemon"],
  ["HEB", "히브리서", "Hebrews"],
  ["JAS", "야고보서", "James"],
  ["1PE", "베드로전서", "1 Peter"],
  ["2PE", "베드로후서", "2 Peter"],
  ["1JN", "요한일서", "1 John"],
  ["2JN", "요한이서", "2 John"],
  ["3JN", "요한삼서", "3 John"],
  ["JUD", "유다서", "Jude"],
  ["REV", "요한계시록", "Revelation"]
];

function findBookFile(dir, bookId) {
  return fs
    .readdirSync(dir)
    .find((file) => file.endsWith(".usfm") && new RegExp(`^\\d+-${bookId}`).test(file));
}

function stripUsfm(text) {
  return text
    .replace(/\\f [\s\S]*?\\f\*/g, " ")
    .replace(/\\x [\s\S]*?\\x\*/g, " ")
    .replace(/\\w ([^|\\]+)\|[^\\]+\\w\*/g, "$1")
    .replace(/\\\+?w ([^|\\]+)\|[^\\]+\\\+?w\*/g, "$1")
    .replace(/\\wj\s*/g, "")
    .replace(/\\wj\*/g, "")
    .replace(/\\[a-z0-9+]+\*?/gi, " ")
    .replace(/\*/g, "")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function parseUsfm(filePath) {
  const source = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const chapters = {};
  let currentChapter = null;
  let currentVerseEntry = null;

  const tokens = source.split(/(?=\\c\s+\d+|\\v\s+\d+)/g);

  for (const token of tokens) {
    const chapterMatch = token.match(/^\\c\s+(\d+)/);
    if (chapterMatch) {
      currentChapter = chapterMatch[1];
      currentVerseEntry = null;
      chapters[currentChapter] ||= [];
      continue;
    }

    const verseMatch = token.match(/^\\v\s+([^\s]+)([\s\S]*)/);
    if (verseMatch && currentChapter) {
      const number = verseMatch[1];
      const text = stripUsfm(verseMatch[2]);

      if (text) {
        currentVerseEntry = { number, text };
        chapters[currentChapter].push(currentVerseEntry);
      }
      continue;
    }

    if (currentChapter && currentVerseEntry) {
      const extra = stripUsfm(token);
      if (extra) {
        currentVerseEntry.text = `${currentVerseEntry.text} ${extra}`.trim();
      }
    }
  }

  return chapters;
}

function parseVersion(dirName) {
  const dir = path.join(root, dirName);
  return Object.fromEntries(
    canonicalBooks.map(([id]) => {
      const file = findBookFile(dir, id);
      if (!file) {
        throw new Error(`Missing ${id} in ${dirName}`);
      }
      return [id, parseUsfm(path.join(dir, file))];
    })
  );
}

function countVerses(books) {
  return Object.values(books).reduce(
    (sum, chapters) => sum + Object.values(chapters).reduce((chapterSum, verses) => chapterSum + verses.length, 0),
    0
  );
}

const text = {
  kor: parseVersion("kor_usfm"),
  web: parseVersion("eng-web_usfm")
};

const data = {
  versions: {
    kor: {
      label: "한국어 성경 1910",
      language: "ko",
      source: "eBible.org Public Domain"
    },
    web: {
      label: "World English Bible Classic",
      language: "en",
      source: "eBible.org Public Domain"
    }
  },
  books: canonicalBooks.map(([id, koName, enName]) => ({ id, koName, enName })),
  text
};

const outPath = path.join(root, "bible-data.js");
fs.writeFileSync(outPath, `window.BIBLE_DATA = ${JSON.stringify(data, null, 2)};\n`, "utf8");

const verseCounts = Object.fromEntries(
  Object.entries(data.text).map(([version, books]) => [version, countVerses(books)])
);

console.log({
  output: outPath,
  books: data.books.length,
  verseCounts
});
