# AGENTS.md

## 개발 명령

- 의존성 설치: `make deps`
- 프런트엔드 빌드·타입 검사: `make build`
- 합성 장부 테스트: `make test`
- 읽기 전용 합성 예제 서버: `make run`

## 코드 원칙

- TypeScript strict 설정 유지
- Rustfava 설치 소스와 실제 재무장부 수정 금지
- 공개 예제와 테스트에는 합성 자료만 사용
- 원본 MIT 저작권 고지 유지
- 기간 최적화는 전체 거래·메타데이터 일치 확인 후 사용
