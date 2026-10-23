# rustfava-dashboards

[fava-dashboards](https://github.com/andreasgerstmayr/fava-dashboards)를 Rustfava 웹 서버에서 사용하는 실험적 호환 확장이다. 원본 React·차트 프런트엔드를 재사용하며, Rustfava와 rustledger에 맞춘 Python 어댑터를 제공한다. 데스크톱 앱은 필요하지 않다.

**현재 상태: 알파.** Rustfava 1.32.0, rustledger WASM 0.22.0, Python 3.14 환경에서 검증했다. PyPI 배포는 하지 않았다. 일반 Fava용 확장은 원본 저장소를 사용한다.

## 제공 기능

- 왼쪽 메뉴의 `Dashboards` 확장 페이지와 TSX 설정
- rustledger BQL 결과의 Amount·Position·잔액·날짜 변환
- 기간·계정·검색 필터, 한글 탭 주소, 기간 변경 후 화면 갱신
- 통합 합성 예제: 종합, 자산, 수익·비용, 흐름도, 순자산 전망, 손익, 현금흐름, 대출
- 한국어 패널 제목·월별 손익 표와 숫자 내용에 맞춘 열 너비
- 계정별 수익·비용 차트, 제한된 크기의 조회 결과 및 기간별 쿼리 세션 캐시

## 설치와 합성 예제

Python 3.13 이상이 필요하다. 아래 명령은 별도 가상환경에서 실행한다. 예제의 거래·금액·투자상품·물가지수는 전부 합성 자료이다.

```sh
git clone https://github.com/MunsuBahk/rustfava-dashboards.git
cd rustfava-dashboards
uv venv --python 3.14
uv pip install .
.venv/bin/python example/integrated/build_config.py
.venv/bin/rustfava --host 127.0.0.1 --port 5099 --read-only --poll-watcher example/integrated/demo.beancount
```

브라우저에서 다음 주소를 연다.

<http://127.0.0.1:5099/dashboard-preview/extension/FavaDashboards/?time=2025-02&dashboard=종합>

설치물에는 빌드한 프런트엔드가 포함되어 있어 실행에 Node.js가 필요하지 않다. 소스를 수정할 때는 아래 개발 절차를 사용한다.

자체 장부에 연결할 때는 장부 디렉터리의 `dashboards.tsx`를 읽는다. 확장 등록 형식은 다음과 같다.

```beancount
2025-01-01 custom "fava-extension" "fava_dashboards"
```

설정 파일 경로를 지정하거나 기간 최적화를 끌 수도 있다.

```beancount
2025-01-01 custom "fava-extension" "fava_dashboards" "{'config': 'my-dashboards.tsx', 'fast_time_filter': False}"
```

기존 장부를 변경하지 않고 연결해야 하는 경우에는 [별도 실행 예제](scripts/run_dashboard.py)를 사용한다. 이 실행기는 읽기 전용 서버에 확장을 등록한다. Rustfava 설치 파일을 수정하지 않는다.

```sh
.venv/bin/python scripts/run_dashboard.py --ledger /path/to/main.beancount --config /path/to/dashboards.tsx --port 5099
```

## 기간 조회 최적화

Rustfava 1.32에서는 새 기간을 조회할 때 전체 Python 거래 목록을 WASM 엔진으로 다시 전송한다. 이 확장은 장부를 엔진 세션에 보관해 기간별 결과만 돌려받는다.

- 서버 시작·장부 재로드 시, 엔진 세션의 전체 거래를 Rustfava가 불러온 거래와 비교한다. 생성 거래와 파일명·줄번호 메타데이터도 비교 대상이다. 시작 시간과 메모리 사용량은 증가한다.
- 전체 결과가 일치할 때만 기간 최적화를 사용한다. 로더나 패딩 처리 차이가 있으면 기존 Rustfava 경로를 사용한다.
- 계정·검색 필터가 있으면 기존 필터 순서를 유지한다. 이 경우 새 기간의 첫 조회 지연은 남을 수 있다.
- 장부 재로드 시 기간·BQL 결과 캐시를 비운다. Rustfava 원본 소스 파일은 수정하지 않으며, 해당 장부 인스턴스의 `get_filtered` 호출을 확장 소유 어댑터로 감싼다.
- 측정 수치는 환경과 장부 크기에 따라 달라진다. 기간 처리 개선이 페이지 전체 로딩 시간을 보장하지는 않는다.

## 검증 범위와 제한

- 확장 로드, JS 모듈, BQL, 월별 필터, 빈 기간, 기초잔액, 패딩·원가·가격·메타데이터, 재로드와 실패 시 원래 경로 복귀를 검증한다.
- 기존 5개 화면은 원본 BQL 차트를 재사용한다. 원본 여행 화면은 통합 예제에서 제외했다. 원본 예제 자체는 보존했다.
- 추가 손익·현금흐름·대출 예제는 원화 정수와 예제 계정·태그 규칙을 사용한다. 다른 장부에 맞는 현금·대출 계정과 분류 규칙은 별도 설정이 필요하다. 자동 회계 분류나 다중 통화 환산을 제공하지 않는다.
- 지원 설정은 v2 JavaScript/TypeScript/JSX/TSX이다. 원본 v1 YAML은 지원하지 않는다.
- 원본 Playwright 스냅샷·Docker·Sphinx 문서는 일반 Fava용 참고 자료이며, Rustfava 호환성 검증을 대신하지 않는다. 원본 문서는 [upstream-readme.md](docs/upstream-readme.md)에 보존했다.

## 개발·검증

Node.js 24 LTS와 pnpm을 사용한다. Python과 프런트엔드 의존성은 별도로 설치한다.

```sh
uv sync
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend run build
pnpm --dir frontend run type-check
uv run pytest -q src/fava_dashboards/utils_test.py tests
uv run python tests/test_hospital_dashboard.py > /tmp/dashboard-postings.json
env HOSPITAL_POSTINGS_JSON=/tmp/dashboard-postings.json node --test tests/hospital-dashboard.test.mjs
```

## 원본과 라이선스

원본은 Andreas Gerstmayr와 기여자가 개발한 [fava-dashboards](https://github.com/andreasgerstmayr/fava-dashboards)이다. 이 저장소는 원본과 독립적으로 유지하는 Rustfava 호환 포크이다. 원본 MIT 저작권 고지와 [LICENSE.md](LICENSE.md)를 유지한다. Rustfava는 [rustledger/rustfava](https://github.com/rustledger/rustfava)에서 개발한다.
