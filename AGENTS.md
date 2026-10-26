# QTN 개발 지침

Photon Quantum 3 `.qtn` DSL을 위한 공유 TypeScript 언어 서버와 TextMate 문법을 VSCode, JetBrains Rider, Visual Studio 2022로 배포한다.

## 시작하기

- 현재 작업과 미커밋 변경은 `git status --short`로 확인한다. 기존 작업을 보존한다.
- Node 버전은 `.nvmrc`를 따른다. 처음 받았거나 lockfile이 바뀌었으면 `npm run setup`으로 세 패키지 의존성을 설치한다.
- `npm run doctor`는 Node와 설치된 직접 의존성을 검사하며, 파일을 수정하지 않는다.
- `npm run verify`는 전체 테스트와 검증 로그를 남긴다. 빠른 반복 작업은 `npm run verify -- --profile quick`, VSCode 패키지까지 확인할 때는 `--profile package`를 사용한다.
- 명령 선택과 결과 해석: [docs/AI_DEVELOPMENT.md](docs/AI_DEVELOPMENT.md).

## 수정 위치

| 작업 | 소스 / 참고 |
|---|---|
| 토큰·구문·AST | `packages/language-server/src/lexer.ts`, `parser.ts`, `ast.ts` |
| 타입·여러 파일의 선언 | `symbol-table.ts`, `project-model.ts` |
| 자동 완성·hover·정의 이동 | `completion.ts`, `hover.ts`, `definition.ts`, `text-navigation.ts` |
| 문서·워크스페이스 심볼, 타입 표시 | `symbols.ts`, `symbol-format.ts` |
| 문서 수명·디스크 읽기 경합 | `server.ts`, `project-file-loader.ts`, `workspace-index.ts`, `uri-utils.ts` |
| TextMate 문법 | `packages/shared/syntaxes/qtn.tmLanguage.json` |
| VSCode 연결 | `packages/vscode-extension/src/extension.ts` |
| Rider 연결 | `packages/jetbrains-plugin/src/main/kotlin/` |
| Visual Studio 연결 | `packages/vs-extension/QtnLanguageClient.cs` |
| 배포 런타임·패키지 검사 | `scripts/prepare-node-runtime.mjs`, `scripts/test-packaged-server.mjs` |
| 개발 검증 하네스 | `scripts/dev/`, `scripts/tests/dev-harness.test.mjs` |

표의 언어 서버 파일명은 `packages/language-server/src/` 기준이다.

## 유지할 계약

- 문법은 **shared 원본만 편집**하고 `npm run sync-grammar`로 세 IDE에 복사한다. IDE 복사본을 직접 수정하지 않는다. [스코프 매핑과 예제](docs/QTN_GRAMMAR_GUIDE.md)를 따른다.
- LSP 기능은 **공유 `packages/language-server/src/`에 구현**한다. `out/`, `dist/`를 직접 수정하지 않는다.
- 세 IDE는 `npm run bundle:server`로 만든 단일 `dist/server.js`를 공유한다. `node_modules`를 패키지에 동봉하지 않는다. Rider/VS는 전용 Node 런타임, VSCode는 호스트 Node를 사용한다.
- 열린 문서 내용이 디스크보다 우선한다. 늦게 끝난 읽기가 열린 문서나 새 내용을 덮거나 삭제 파일을 되살리지 않아야 한다.
- 초기 검색과 watcher의 Unity 캐시 제외 규칙을 일치시킨다. 캐시 파일을 직접 열면 편집 기능을 제공하고 닫을 때 제거한다.
- 여러 파일에 나뉜 같은 타입의 필드와 선언 위치를 보존한다. 파일 읽기 순서에 결과가 좌우되면 안 된다.
- URI를 문자열로 경로 변환하지 않는다. 공백·한글·인코딩과 Windows 드라이브를 고려해 기존 URI 유틸리티를 사용한다.
- 미완성 QTN도 편집기의 정상 입력이다. 파서 복구 시 다음 선언을 잃지 않고, LSP 범위와 선택 범위를 유효하게 유지한다.
- stdio 서버의 stdout은 LSP 전용이다. 디버그 출력으로 프로토콜을 오염시키지 않는다.

## 검증과 작업 범위

- 버그는 가능하면 수정 전 실패하는 작은 회귀 사례로 재현한다. 기능에 맞는 핸들러/프로토콜/문법 테스트를 고른다.
- 테스트 헬퍼·파일과 세부 명령은 [개발 가이드](docs/AI_DEVELOPMENT.md)에 있다. 전체 검증은 CI에서도 같은 `npm run verify`를 실행한다.
- `.artifacts/verification/`의 `report.json`은 실행한 명령·상태·종료 코드와 로그 경로를 담는다. `quick` 통과를 전체 검증 통과로 보고하지 않는다.
- 패키지 서버 실행과 실제 IDE UI 검증을 구분한다. 사용하지 못한 JDK/Windows/IDE 검증은 수행했다고 보고하지 않는다.
- 컴파일러 진단·포매팅·rename 및 다른 에디터 지원은 별도 기능 요청에 따른다. 기존 타입 참조 semantic token은 구현되어 있다.
- 대형 Unity 프로젝트 성능 측정은 현재 요청 범위에서 제외한다.

## 저장소 로컬 스킬

- [.agents/skills/qtn-development/SKILL.md](.agents/skills/qtn-development/SKILL.md): QTN 문법/LSP 수정 및 회귀 검증.
- [.agents/skills/qtn-package-verification/SKILL.md](.agents/skills/qtn-package-verification/SKILL.md): 실제 VSIX/Rider ZIP 구성과 서버 실행 검증.

## 관련 문서

- [DSL 문법](docs/DSL.md), [설치 안내](docs/HOW_TO_INSTALL.md), [런타임 패키징](docs/RUNTIME_PACKAGING.md)
- [Rider 빌드](packages/jetbrains-plugin/README.md#building-from-source): JDK 21 필요. VS 빌드는 Windows + VS 빌드 도구 필요.
- [Photon 공식 DSL](https://doc.photonengine.com/quantum/v3/manual/quantum-ecs/dsl)
- [배포된 JetBrains 플러그인](https://plugins.jetbrains.com/plugin/32137-quantum-dsl-qtn-language-support)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
