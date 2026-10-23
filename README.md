# rustfava-dashboards

[fava-dashboards](https://github.com/andreasgerstmayr/fava-dashboards)를 Rustfava 웹 서버에서 사용할 수 있도록 만든 호환 확장입니다. 원본 React·차트 프런트엔드를 재사용하고, Rustfava와 rustledger에 맞춘 Python 어댑터를 제공합니다. 웹 브라우저에서 대시보드를 열어 사용할 수 있습니다.

**현재 알파 버전입니다.** Rustfava 1.32.0, rustledger WASM 0.22.0 환경에서 검증했습니다. Python 3.14를 사용하는 Linux와 macOS에서 설치·실행을 확인했습니다. PyPI에는 아직 배포하지 않았습니다. 일반 Fava를 사용하신다면 [원본 확장](https://github.com/andreasgerstmayr/fava-dashboards)을 이용하실 수 있습니다.

## 제공 기능

- 왼쪽 메뉴의 `Dashboards` 확장 페이지와 TSX 설정
- rustledger BQL 결과의 Amount·Position·잔액·날짜 변환
- 기간·계정·검색 필터, 한글 탭 주소, 기간 변경 후 화면 갱신
- 통합 합성 예제: 종합, 자산, 수익·비용, 흐름도, 순자산 전망, 손익, 현금흐름, 대출
- 한국어 패널 제목·월별 손익 표와 숫자 내용에 맞춘 열 너비
- 계정별 수익·비용 차트와 조회 결과·기간별 쿼리 세션 캐시

## 설치 전 준비

아래 명령은 **macOS와 Linux의 터미널**을 기준으로 안내합니다. 기본 설치에는 Git과 Python 3.13 이상이 필요합니다. Python 기본 도구인 `venv`로 가상환경을 만들고 `pip`로 패키지를 설치합니다.

```sh
git --version
python3 --version
```

명령을 찾을 수 없거나 Python 버전이 3.13 미만이라면 [Git 설치 안내](https://git-scm.com/install/)와 [Python 다운로드 안내](https://www.python.org/downloads/)를 참고해 준비합니다. 설치한 Python 3.13 이상이 `python3` 명령으로 실행되는지 확인합니다.

- Rustfava와 필요한 Python 패키지는 함께 설치됩니다. 별도로 설치된 Rustfava가 없어도 시작할 수 있습니다.
- 빌드한 프런트엔드가 포함되어 있으므로 예제를 실행할 때 Node.js나 pnpm을 설치할 필요는 없습니다.
- 첫 설치와 첫 실행에는 패키지 및 rustledger WASM 구성 요소를 내려받기 위한 인터넷 연결이 필요합니다.
- uv는 선택 가능한 설치 도구입니다. 사용 방법은 아래의 별도 항목에서 안내합니다.

## 합성 예제로 시작하기

먼저 가상 거래만 들어 있는 예제를 실행해 볼 수 있습니다. 다음 명령은 새 `rustfava-dashboards` 디렉터리와 그 안의 `.venv` 가상환경을 사용합니다. 가상환경 안의 실행 파일을 직접 지정하므로 별도의 활성화 명령 없이 사용할 수 있습니다.

### 기본 설치: venv와 pip

```sh
git clone https://github.com/MunsuBahk/rustfava-dashboards.git
cd rustfava-dashboards
python3 -m venv .venv
.venv/bin/python -m pip install .
.venv/bin/python example/integrated/build_config.py
.venv/bin/rustfava --host 127.0.0.1 --port 5099 --read-only --poll-watcher example/integrated/demo.beancount
```

마지막 명령이 실행 중인 상태에서 **같은 컴퓨터의 브라우저**로 다음 주소를 엽니다.

<http://127.0.0.1:5099/dashboard-preview/extension/FavaDashboards/?time=2025-02&dashboard=종합>

- 왼쪽 메뉴에 `Dashboards`가 표시되고, 위쪽에 8개 대시보드 탭이 보이면 예제가 실행된 상태입니다.
- `time=2025-02`는 예제 거래가 있는 2025년 2월을 선택합니다. 기간을 2025년 1월로 바꾸면 차트와 표가 갱신됩니다.
- 예제의 거래·금액·투자상품·물가지수는 모두 합성 자료입니다.
- 서버가 실행 중인 동안에는 터미널을 열어 둡니다. 종료할 때는 해당 터미널에서 `Ctrl+C`를 누릅니다.

### 대안: uv로 설치하기

uv를 사용하는 경우에는 기본 설치의 `python3 -m venv .venv`와 `pip install` 단계를 다음 명령으로 대신할 수 있습니다. 새로 복제한 저장소 디렉터리에서 실행하며, 두 설치 방식 중 하나를 선택합니다.

uv가 없다면 [공식 설치 안내](https://docs.astral.sh/uv/getting-started/installation/)를 참고하거나 다음 명령으로 설치합니다. 설치 후 터미널을 다시 열고 `uv --version`을 확인합니다.

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```

```sh
uv venv --python 3.14
uv pip install --python .venv/bin/python .
.venv/bin/python example/integrated/build_config.py
.venv/bin/rustfava --host 127.0.0.1 --port 5099 --read-only --poll-watcher example/integrated/demo.beancount
```

Python 3.14가 없으면 uv가 [해당 버전을 자동으로 내려받습니다](https://docs.astral.sh/uv/guides/install-python/#automatic-python-downloads). 실행 후에는 기본 설치와 같은 브라우저 주소로 접속합니다.

### 실행 중 확인할 점

- **처음 실행할 때 시간이 걸리는 경우:** WASM 구성 요소 다운로드와 장부 검증이 끝날 때까지 기다립니다. 서버가 시작된 다음 브라우저를 열면 됩니다.
- **Linux에서 `venv` 생성에 실패하는 경우:** Python 배포판의 `venv`·`ensurepip` 구성 요소가 설치되어 있는지 확인합니다. Debian·Ubuntu의 기본 Python을 사용하는 경우에는 `python3-venv` 패키지가 필요할 수 있습니다.
- **5099번 포트가 이미 사용 중인 경우:** 실행 명령의 `--port 5099`와 브라우저 주소의 `:5099`를 모두 다른 포트 번호로 바꿉니다.
- **다른 컴퓨터에서 접속하는 경우:** 위 명령의 `127.0.0.1`은 서버가 실행 중인 컴퓨터 안에서만 접속할 수 있는 주소입니다. 원격 서버에 설치했다면 서버 주소·접속 경로를 별도로 설정해야 합니다.

## 자체 장부에 연결하기

합성 예제를 확인한 다음 자체 장부를 연결하실 수 있습니다. 아래 명령도 저장소 디렉터리에서 실행합니다.

### 장부 파일을 변경하지 않고 실행하기

[별도 실행기](scripts/run_dashboard.py)는 읽기 전용 서버에 확장을 등록합니다. `/absolute/path/to/main.beancount`를 실제 장부 파일의 절대 경로로 바꿉니다. 설정 파일에는 앞에서 생성한 통합 예제를 지정합니다.

```sh
.venv/bin/python scripts/run_dashboard.py --ledger /absolute/path/to/main.beancount --config example/integrated/dashboards.tsx --port 5099
```

이미 예제 서버가 실행 중이라면 먼저 `Ctrl+C`로 종료합니다. 서버가 시작되면 <http://127.0.0.1:5099/>에 접속해 장부를 선택하고 왼쪽의 `Dashboards` 메뉴에서 대시보드를 확인할 수 있습니다.

통합 예제의 설정을 그대로 사용하면 일부 차트는 장부의 계정명·태그에 맞게 조정해야 합니다. 특히 추가된 현금흐름·대출 화면은 `Assets:Cash:`, `Liabilities:Loans:` 계정과 예제의 거래 태그 규칙을 사용합니다. 해당 규칙은 [합성 장부 설명](example/hospital/README.md#계산-규칙)에 정리되어 있습니다. 자체 장부에 맞게 설정 파일을 조정한 후 결과를 확인합니다.

### 장부에서 확장 등록하기

기존 Rustfava 실행 방식에 확장을 등록하고 싶다면, 확장을 설치한 Python 환경에서 Rustfava를 실행하고 장부에 다음 항목을 추가할 수 있습니다. 이 방식은 장부 파일을 수정합니다.

```beancount
2025-01-01 custom "fava-extension" "fava_dashboards"
```

이때는 장부 파일과 같은 디렉터리에 `dashboards.tsx`를 둡니다. 통합 예제를 사용하려면 앞에서 생성한 `example/integrated/dashboards.tsx`를 복사하실 수 있습니다.

설정 파일 경로를 직접 지정하거나 기간 최적화를 끌 수도 있습니다. 상대 경로는 장부 파일의 디렉터리를 기준으로 해석합니다.

```beancount
2025-01-01 custom "fava-extension" "fava_dashboards" "{'config': 'my-dashboards.tsx', 'fast_time_filter': False}"
```

## 기간 조회 최적화

Rustfava 1.32에서는 새 기간을 조회할 때 전체 Python 거래 목록을 WASM 엔진으로 다시 전송합니다. 이 확장은 장부를 엔진 세션에 보관하고 기간별 결과만 돌려받아 이 과정을 줄입니다.

- 서버 시작·장부 재로드 시 엔진 세션의 전체 거래를 Rustfava가 불러온 거래와 비교합니다. 생성 거래와 파일명·줄번호 메타데이터도 비교하므로 시작 시간과 메모리 사용량은 증가합니다.
- 전체 결과가 일치할 때만 최적화를 사용합니다. 로더나 패딩 처리에 차이가 있으면 기존 Rustfava 경로로 처리합니다.
- 계정·검색 필터가 있으면 기존 필터 순서를 유지합니다. 이 경우 새 기간의 첫 조회 지연은 남을 수 있습니다.
- 장부를 다시 불러오면 기간·BQL 결과 캐시를 비웁니다. 해당 장부 인스턴스의 `get_filtered` 호출을 확장 소유 어댑터로 감싸며, Rustfava 원본 소스 파일은 수정하지 않습니다.
- 성능은 환경과 장부 크기에 따라 달라집니다. 기간 처리 시간과 페이지 전체 로딩 시간은 차이가 있을 수 있습니다.

## 검증 범위와 제한

- 확장 로드, JS 모듈, BQL, 월별 필터, 빈 기간, 기초잔액, 패딩·원가·가격·메타데이터, 재로드와 실패 시 기존 경로 복귀를 검증했습니다.
- 기존 5개 화면은 원본 BQL 차트를 재사용합니다. 원본 여행 화면은 통합 예제에서 제외했으며, 원본 예제 자체는 보존했습니다.
- 추가 손익·현금흐름·대출 예제는 원화 정수와 예제 계정·태그 규칙을 사용합니다. 다른 장부에는 현금·대출 계정과 분류 규칙을 별도로 설정해야 합니다. 자동 회계 분류나 다중 통화 환산은 제공하지 않습니다.
- v2 JavaScript/TypeScript/JSX/TSX 설정을 지원합니다. 원본 v1 YAML 형식은 지원하지 않습니다.
- 원본 Playwright 스냅샷·Docker·Sphinx 문서는 일반 Fava용 참고 자료입니다. Rustfava 호환성은 이 저장소의 별도 테스트로 검증합니다. 원본 문서는 [upstream-readme.md](docs/upstream-readme.md)에 보존했습니다.

## 개발·검증

이 절은 소스를 수정하고 빌드·테스트할 때 사용하는 개발 절차입니다. 일반적인 설치·실행에는 필요하지 않습니다.

Python 개발 환경에는 uv를, 프런트엔드에는 Node.js 24 LTS와 pnpm을 사용합니다. 이는 이 저장소에서 선택한 개발 도구이며, 저장소에 pnpm 버전이 고정되어 있습니다. uv 설치 방법은 위의 대안 설치 항목에서 안내합니다. pnpm이 없다면 [공식 설치 안내](https://pnpm.io/installation)를 참고하거나 다음 독립 실행 설치 명령을 사용할 수 있습니다.

```sh
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

설치 후 터미널을 다시 열고 도구 버전을 확인합니다.

```sh
uv --version
node --version
pnpm --version
```

다음 명령으로 개발 의존성을 설치하고 빌드와 테스트를 실행할 수 있습니다.

```sh
uv sync --locked
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend run build
pnpm --dir frontend run type-check
uv run pytest -q src/fava_dashboards/utils_test.py tests
uv run python tests/test_hospital_dashboard.py > /tmp/dashboard-postings.json
env HOSPITAL_POSTINGS_JSON=/tmp/dashboard-postings.json node --test tests/hospital-dashboard.test.mjs
```

## 원본과 라이선스

원본은 Andreas Gerstmayr와 기여자가 개발한 [fava-dashboards](https://github.com/andreasgerstmayr/fava-dashboards)입니다. 이 저장소는 원본과 독립적으로 유지하는 Rustfava 호환 포크입니다. 원본 MIT 저작권 고지와 [LICENSE.md](LICENSE.md)를 유지합니다. Rustfava는 [rustledger/rustfava](https://github.com/rustledger/rustfava)에서 개발합니다.
