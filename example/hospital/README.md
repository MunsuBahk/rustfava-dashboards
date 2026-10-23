# 병원 대시보드 합성 장부 예제

- 검증 환경: Rustfava 1.32.0, rustledger WASM v0.22.0, Python 3.14, Node.js 24
- 구성: `hospital.beancount` 합성 거래, `dashboards.tsx` 손익·현금흐름·대출 화면
- 모든 거래와 금액은 테스트용 가상 자료이다.
- 실행 방법은 저장소 루트의 README 참조

## 검증 기준

| 항목 | 2025-01 | 2025-02 |
|---|---:|---:|
| 환불 차감 순매출 | 11,000,000 | 13,000,000 |
| 비용·이자 | 6,200,000 | 7,240,000 |
| 이익 | 4,800,000 | 5,760,000 |
| 기초 현금 | 10,000,000 | 12,800,000 |
| 현금 유입 | 15,000,000 | 17,000,000 |
| 현금 유출 | 12,200,000 | 8,740,000 |
| 영업활동 현금흐름 | 2,800,000 | 7,760,000 |
| 투자활동 현금흐름 | -4,000,000 | 0 |
| 재무활동 현금흐름 | 4,000,000 | 500,000 |
| 기말 현금 | 12,800,000 | 21,060,000 |
| 대출 실행 | 5,000,000 | 0 |
| 원금 상환 | 1,000,000 | 1,500,000 |
| 기말 대출 원금 | 24,000,000 | 22,500,000 |
| 이자 | 200,000 | 240,000 |

단위는 KRW이다. 2025-03은 거래가 없으며 현금 21,060,000원과 대출 22,500,000원을 유지한다. 2026-01의 매출·추가 대출은 2025년 조회에 포함되지 않는다.

## 계산 규칙

- 손익은 `Income:`과 `Expenses:`의 부호 있는 posting으로 계산한다. 환불은 매출에서 차감한다.
- 외상매출은 발생한 달의 매출이다. 다음 달 회수는 현금 유입이며 매출을 다시 인식하지 않는다.
- 현금 계정은 `Assets:Cash:` 하위 계정이다. BQL의 거래 `id`로 동일 거래의 현금 posting을 합산하여 내부 이체를 제외한다.
- 현금흐름은 `operating`, `investing`, `financing`, `opening` 거래 태그로 구분한다. 분류 태그는 거래별 하나를 사용한다.
- 이 예제에서는 지급이자를 영업활동 현금흐름으로 표시한다. `loan-repayment` 거래에 포함된 `Expenses:Interest:` 금액은 원금 상환과 분리한다.
- 대출 계정은 `Liabilities:Loans:A`, `Liabilities:Loans:B`이다. 이자는 같은 접미사의 `Expenses:Interest:A`, `Expenses:Interest:B`에 기록한다.
- `loan-draw`는 대출 실행, `loan-repayment`는 원금 상환이다. 기초 부채는 신규 대출 실행에 포함하지 않는다.
- 잔액 계산용 BQL 요청은 `time`만 제거하고 이전 거래를 포함한다. 표시 기간은 `filterFirst`와 `filterLast`로 적용한다. 계정·검색 필터는 유지한다.
- 원화 정수만 지원한다. 다른 통화나 안전한 정수 범위를 벗어난 금액은 오류로 표시한다. 통화 환산은 구현하지 않았다.
- 계산용 원본 장부에 거래가 없는 달도 활동 0과 이월 잔액을 표시한다.

## 검증 실행

Python 테스트는 저장소 루트에서 테스트 가상환경의 Python으로 실행한다.

```sh
python -m pytest -q src/fava_dashboards/utils_test.py tests/test_rustfava_extension.py tests/test_hospital_dashboard.py
python tests/test_hospital_dashboard.py > /tmp/hospital-postings.json
```

Node 테스트는 실제 BQL 결과로 계산 함수를 검증한다.

```sh
HOSPITAL_POSTINGS_JSON=/tmp/hospital-postings.json node --test tests/hospital-dashboard.test.mjs
```

## 호환성 수정

- 거래가 없는 조회 기간에도 확장 메타데이터 API가 정상 응답하도록 처리한다.
- 한글 대시보드 이름을 탭 주소에서 보존하여 서로 다른 이름이 같은 주소로 변환되지 않도록 한다.
- 탭 주소를 Rustfava와 동기화하여 기간 필터 변경 후에도 현재 화면을 유지한다.
