.PHONY: deps build test run
deps:
	uv sync --locked
	pnpm --dir frontend install --frozen-lockfile

build:
	pnpm --dir frontend run build
	pnpm --dir frontend run type-check

test:
	uv run pytest -q src/fava_dashboards/utils_test.py tests
	uv run python tests/test_hospital_dashboard.py > /tmp/dashboard-postings.json
	HOSPITAL_POSTINGS_JSON=/tmp/dashboard-postings.json node --test tests/hospital-dashboard.test.mjs

run:
	uv run python example/integrated/build_config.py
	uv run rustfava --host 127.0.0.1 --port 5099 --read-only --poll-watcher example/integrated/demo.beancount
