# AI와 함께 개발하기

저장소 규칙은 [AGENTS.md](../AGENTS.md), 필요할 때 읽는 작업 절차는 [로컬 스킬](../.agents/skills/)에 둔다. `CLAUDE.md`도 같은 지침을 참조한다. 전역 에이전트 설정을 바꾸거나 별도 서비스를 설치할 필요는 없다.

## 환경 준비

```sh
nvm install
nvm use
npm run setup
npm run doctor
```

nvm은 선택 사항이다. 다른 Node 관리 도구를 사용하면 `.nvmrc`의 버전을 선택한다. `setup`은 루트·언어 서버·VSCode 패키지의 lockfile로 의존성을 설치하고 문법을 동기화한다. 의존성이 바뀌지 않았다면 매 작업마다 다시 설치할 필요는 없다.

`doctor`는 현재 Node, npm 실행 경로, 세 패키지의 직접 의존성 버전과 lockfile 일치 여부를 확인한다. 누락·오래된 의존성은 실패와 복구 명령으로 표시한다. 지원 범위 내지만 CI와 다른 Node는 경고한다. 설치·동기화·소스 수정은 하지 않는다. 모든 전이 의존성의 무결성이나 네이티브 툴체인을 검사하는 명령은 아니다.

Rider 빌드는 JDK 21, Visual Studio 빌드는 Windows와 VS 빌드 도구가 필요하다. 공유 서버 개발에는 필요하지 않다. 자세한 절차는 [Rider README](../packages/jetbrains-plugin/README.md#building-from-source)와 [설치 가이드](HOW_TO_INSTALL.md)를 따른다.

## 검증 하네스

| 명령 | 수행하는 검증 |
|---|---|
| `npm run verify -- --profile quick` | 환경, 문법 복사본 일치, 소스·테스트 타입 검사, LSP 단위 테스트 |
| `npm run verify` | 환경 + 기존 `npm test` 전체: 문법 일치, 타입, 개발/런타임 도구, LSP 단위·stdio 통합, TextMate 단위·스냅샷 |
| `npm run verify -- --profile package` | 전체 검증 + 새 VSIX 빌드 + VSIX에서 추출한 서버의 LSP 응답 |
| `npm run test:tools` | 검증 하네스와 런타임 패키징 도구의 테스트 |

검증은 설치나 게시를 하지 않는다. `package`는 컴파일·번들·VSIX 산출물을 만들며 기존 prepublish 절차에서 문법을 동기화한다. 앞선 문법 일치 검사에서 불일치가 발견되면 실패하므로 이를 자동으로 숨기지 않는다.

각 실행은 `.artifacts/verification/<시각>-<프로필>-<고유값>/`에 다음을 기록한다.

- `report.json`: schemaVersion, profile, status, 실행 시작/종료 시각, Node/OS, 시작 시점의 Git HEAD와 변경 파일 상태, 각 단계의 명령·종료 코드·로그 위치.
- `1.log`, `2.log`, …: 단계별 stdout/stderr. `log` 경로는 보고서가 있는 디렉토리 기준이다.
- `qtn.vsix`: `package` 프로필에서 새로 생성한 패키지.

모든 단계가 끝나야 `passed`다. 실패 시 후속 단계는 `skipped`가 되며 명령은 0이 아닌 종료 코드를 반환한다. 한 단계가 10분을 넘으면 자식 프로세스 트리를 종료하고 `timed-out`으로 기록한다. Ctrl+C는 `interrupted`로 기록한다. 강제 종료나 전원 차단으로 남은 `running` 보고서도 성공을 의미하지 않는다. 로그와 산출물은 Git에서 제외된다. 필요 없어진 실행 디렉토리만 지우면 된다.

기계가 읽을 때는 npm 자체 배너도 제거한다.

```sh
npm --silent run doctor -- --json
npm --silent run verify -- --profile quick --json
```

`--json`은 단계 출력을 터미널에서 숨기고 최종 JSON을 stdout에 출력한다. 자세한 출력은 로그에 남는다. CI도 `npm run verify`를 사용하고, 성공·실패 여부와 관계없이 만들어진 보고서와 로그를 아티팩트로 보관한다. 로컬 통과를 원격 CI 완료로 해석하지 않는다.

`quick`에는 stdio 통합·TextMate 테스트가 없다. 문법 수정 후에는 관련 문법 테스트를 직접 실행하거나 `full`을 사용한다. `package`도 실제 VSCode Extension Host 화면, Rider UI, Visual Studio UI를 실행하지 않는다. 해당 검증은 별도로 수행하고 범위를 명시한다.

## 변경 종류에 맞는 재현

| 변경 | 최소 재현 위치 / 명령 |
|---|---|
| 파서·완성·hover·정의 이동 | `packages/language-server/src/__tests__/`; `npm --prefix packages/language-server test -- src/__tests__/completion.test.ts` 등 필요한 파일 지정 |
| 문서 열기/닫기·watcher·stdio 응답 | `src/__tests__/integration/`; `npm --prefix packages/language-server run test:integration` |
| TextMate 색상·스코프 | `packages/vscode-extension/tests/unit/*.test`; `npm --prefix packages/vscode-extension test` |
| TextMate 전체 토큰 변화 | `packages/vscode-extension/tests/snap/`; `npm --prefix packages/vscode-extension run test:snap` |
| 패키지 내용·실행기 | `scripts/tests/node-runtime.test.mjs`; `npm run test:runtimes` 및 실제 패키지 검사 |
| 환경·검증 실행기 | `scripts/tests/dev-harness.test.mjs`; `npm run test:tools` |

핸들러 테스트는 `src/__tests__/helpers.ts`의 `setupDocument(source, uri)`를 사용한다. `ProjectModel`만 갱신하면 handler가 읽는 열린 문서가 빠질 수 있으므로 반환된 `documents`도 전달한다. 여러 파일 선언은 동일 모델에 다른 URI로 추가한다. LSP 위치는 0부터 센다.

프로토콜 테스트는 실행 전에 서버를 컴파일한다. 직접 `out/server.js`를 띄운 실험은 최신 소스로 다시 빌드했는지 확인한다. 디스크 읽기 경합은 `project-file-loader.test.ts`, 분할 선언은 `partial-declarations.test.ts`를 참고한다. 고정 sleep보다 결과를 기다리는 assertion이나 제어 가능한 읽기 Promise를 사용한다.

문법의 스코프 매핑·예제는 [QTN_GRAMMAR_GUIDE.md](QTN_GRAMMAR_GUIDE.md)에 있다. 항상 공유 원본을 고친 뒤 동기화한다. 스냅샷 변경은 의도한 토큰 차이를 확인하고 반영한다.

## 로컬 스킬

- [qtn-development](../.agents/skills/qtn-development/SKILL.md): QTN LSP·문법 변경을 적절한 회귀 사례와 검증으로 연결한다.
- [qtn-package-verification](../.agents/skills/qtn-package-verification/SKILL.md): VSIX/Rider ZIP을 실제로 추출하고 서버를 실행하는 검증 절차다.

`.agents/skills/`를 탐색하는 에이전트는 저장소 로컬 스킬을 사용할 수 있다. 현재 세션에 새 스킬이 자동 표시되지 않으면 해당 `SKILL.md` 경로를 직접 읽게 하거나 새 세션에서 사용한다. 다른 도구에서도 Markdown 지침을 그대로 읽을 수 있다.

결과 보고에는 수정한 동작, 실행한 검증 프로필, 실패/미검증 부분, 보고서 위치를 적는다. 이 하네스는 대형 Unity 프로젝트 성능 측정을 수행하지 않는다.
