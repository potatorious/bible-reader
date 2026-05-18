# 성경 읽기

한국어와 영어 성경을 절 단위로 읽을 수 있는 정적 웹앱입니다. 빠르게 열고, 조용히 읽고, 번역을 바꿔가며 같은 본문을 이어서 볼 수 있도록 만든 MVP입니다.

## 주요 기능

- 한국어/영어 번역 선택
- 성경 66권, 장, 절 직접 이동
- 이전/다음 절 이동
- 전체 읽기 진행률 표시
- 현재 절 음성 읽기와 중지
- 글자 크기 조절
- 읽기 설정 패널
  - 밝은 화면, 고대비 화면, 어두운 화면
  - 줄 간격
  - 본문 폭
  - 자간
  - 음성 속도
- 모바일과 데스크톱 반응형 레이아웃

## 데이터

`bible-data.js`는 `kor_usfm`과 `eng-web_usfm`의 USFM 원본을 변환해 생성한 정적 데이터입니다.

| 항목 | 내용 |
| --- | --- |
| 한국어 | Korean Bible 1910, eBible.org Public Domain |
| 영어 | World English Bible Classic, eBible.org Public Domain |
| 범위 | 성경 66권 |
| 공통 절 | 30,984개 |

번역본마다 절 구분이 완전히 같지는 않습니다. 앱은 한국어와 영어 양쪽에 모두 존재하는 공통 절만 이동 대상으로 사용해서, 번역을 바꿔도 같은 참조가 최대한 유지되도록 맞췄습니다.

## 실행

저장소를 내려받은 뒤 `index.html`을 브라우저에서 열면 됩니다. 파일 탐색기에서 `index.html`을 더블클릭해도 됩니다.

## 파일 구조

```text
bible-reader/
├─ index.html          # 화면 구조
├─ styles.css          # 읽기 화면과 설정 UI 스타일
├─ app.js              # 본문 이동, 번역 선택, 음성 읽기, 설정 상태
├─ bible-data.js       # 변환된 성경 데이터
├─ tools/
│  └─ convert-usfm.js  # USFM 원본을 bible-data.js로 변환
├─ kor_usfm/           # 한국어 USFM 원본
├─ eng-web_usfm/       # 영어 WEB USFM 원본
└─ README.md
```

## 데이터 재생성

USFM 원본을 수정하거나 다시 받은 뒤에는 아래 명령으로 `bible-data.js`를 재생성합니다.

```powershell
node tools\convert-usfm.js
```

## 검증

JavaScript 문법 검사는 아래 명령으로 확인합니다.

```powershell
node --check app.js
node --check bible-data.js
node --check tools\convert-usfm.js
```

데이터 요약은 아래 명령으로 확인할 수 있습니다.

```powershell
node -e "const fs=require('fs');const vm=require('vm');const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('bible-data.js','utf8'),sandbox);const data=sandbox.window.BIBLE_DATA;const refs=Object.keys(data.text.kor).flatMap(book=>Object.entries(data.text.kor[book]).flatMap(([ch,verses])=>verses.map((v,i)=>v&&data.text.web[book]?.[ch]?.[i]?1:0))).filter(Boolean).length;console.log({translations:Object.keys(data.translations),books:data.books.length,commonVerses:refs});"
```

## GitHub Pages 배포

GitHub 저장소에서 다음 순서로 설정하면 정적 페이지로 배포할 수 있습니다.

1. `Settings`로 이동
2. `Pages` 선택
3. `Build and deployment`에서 `Deploy from a branch` 선택
4. Branch를 `main`, 폴더를 `/root`로 설정
5. `Save`

배포 주소는 보통 아래 형식입니다.

```text
https://potatorious.github.io/bible-reader/
```

## 메모

음성 읽기는 브라우저의 Web Speech API를 사용합니다. 한국어와 영어 음성 품질은 사용자의 운영체제, 브라우저, 설치된 음성 엔진에 따라 달라질 수 있습니다.
