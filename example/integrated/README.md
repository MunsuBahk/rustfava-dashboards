# 통합 대시보드 미리보기

- 접속: http://127.0.0.1:5099/dashboard-preview/extension/FavaDashboards/?time=2025-02
- 메뉴: 종합, 자산, 수익·비용, 흐름도, 순자산 전망, 손익, 현금흐름, 대출
- 원본 `example/dashboards.tsx`에서 여행을 제외한 5개 화면과 `example/hospital/dashboards.tsx`의 3개 화면을 재사용한다.
- `build_config.py`가 통합 `dashboards.tsx`와 `demo.beancount`를 생성한다. 원본 설정 파일을 덮어쓰지 않는다.
- 모든 거래는 합성 자료이다. 원화 거래, 가상 투자상품 DEMO, 가상 CPI를 포함한다. 실제 재무장부와 연결하지 않는다.
- 추가 3개 화면은 KRW posting을 대상으로 계산한다. 환율·가격 변환은 원본 5개 화면의 BQL을 사용한다. 실제 통화·투자상품의 회계 처리는 별도 검증 대상이다.

## 계정 기반 차트

- 종합의 월별 수익·비용: 수익은 합계, 비용은 `Expenses:분류` 계정별 자동 집계
- 수익·비용의 월별 비용 계정: 원본 Food 전용 패널을 전체 비용 계정별 추이로 교체
- 범례에는 실제 계정명을 사용하고, 차트 클릭 시 해당 계정과 월로 이동
- 거래가 없는 월은 0으로 표시하고, 월 축은 범주형으로 표시
- `account_panels.tsx`에서 통합 설정의 해당 패널만 교체

## 호환 계층

- 원본 5개 화면의 Amount 결과에 통화별 접근 키를 제공하고 기존 number/currency 값을 보존한다.
- 원본 쿼리의 `INTERVAL('1 month')` 형식을 rustledger의 `INTERVAL(1, 'month')` 형식으로 변환한다.
- 연도별 범주 축에 문자열 연도를 사용한다.
- 호환 ledger 객체를 WeakMap에 보관해 React 효과의 반복 요청을 막는다.
- 거래가 없는 기간의 흐름도에는 빈 기간 안내를 표시한다.
- 상단 메뉴·패널 제목·통화 선택 레이블·자산 범위 선택 항목을 한국어로 표시한다. 계정명과 내부 옵션 값은 유지한다. `korean_panels.tsx`가 패널 표시 이름을 번역한다.

## 확인한 범위

- 여행 제거 전 9개 탭 브라우저 탐색과 대출 탭의 1월·2월 기간 전환
- 여행 제거 전 비 React 패널 31개의 1월·2월·3월 실제 BQL 실행 및 유한 수치 검사
- React 연도별 수익·비용 패널 2개의 브라우저 표시
- 기존 Python 통합 테스트와 추가 손익·현금흐름·대출 계산 테스트

## 재생성

```sh
python example/integrated/build_config.py
uv run rustfava --host 127.0.0.1 --port 5099 --read-only --poll-watcher example/integrated/demo.beancount
```

