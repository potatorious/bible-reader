# 말씀 읽기 MVP

눈이 좋지 않은 어르신도 편하게 읽을 수 있도록 만든 성경 읽기용 정적 웹앱 MVP입니다.

## 실행

브라우저에서 `index.html`을 열면 됩니다. 별도 빌드나 서버가 필요 없습니다.

## 포함 기능

- 한글/영어 전체 성경 본문 보기
- 한글/영어 1:1 공통 절 기준 탐색
- 이전/다음 구절 이동
- 오늘의 말씀
- 글자 크기 조절
- 밝은 고대비 화면과 어두운 화면
- 번역/성경/장/절 선택
- 모바일/데스크톱 반응형 레이아웃

## 파일 구조

```text
bible-terminal-mvp/
  index.html
  styles.css
  app.js
  bible-data.js
  tools/
    convert-usfm.js
  kor_usfm/
  eng-web_usfm/
  README.md
```

## 데이터 메모

`bible-data.js`는 `kor_usfm`과 `eng-web_usfm`의 USFM 원본을 변환해서 생성합니다.

- 한글: 한국어 성경 1910, eBible.org Public Domain
- 영어: World English Bible Classic, eBible.org Public Domain
- 범위: 66권 정경
- 탐색 기준: 한글과 영어 양쪽 모두 존재하는 공통 절 30,984개

두 번역본의 절 구분이 완전히 같지는 않습니다. 앱의 책/장/절 선택과 이전/다음 이동은 양쪽 번역본에 모두 존재하는 절만 사용해서, 번역을 바꿔도 같은 참조가 항상 대응되도록 맞춰 두었습니다.

원본 USFM을 다시 받은 뒤에는 아래 명령으로 데이터를 재생성할 수 있습니다.

```powershell
node tools\convert-usfm.js
```
