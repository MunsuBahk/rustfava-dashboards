"""원본 장부를 수정하지 않고 읽기 전용 대시보드 서버를 실행한다."""

import argparse
from pathlib import Path

from cheroot.wsgi import Server
from rustfava.application import create_app

from fava_dashboards import FavaDashboards


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5099)
    args = parser.parse_args()
    app = create_app([str(args.ledger.resolve())], load=True, read_only=True, poll_watcher=True)
    for ledger in app.config["LEDGERS"].ledgers:
        extension = ledger.extensions.get_extension("FavaDashboards")
        if extension is None:
            extension = FavaDashboards(ledger, repr({"config": str(args.config.resolve())}))
            ledger.extensions._instances[extension.name] = extension
            ledger.extensions._loaded_extensions.add(FavaDashboards)
            extension.after_load_file()
        else:
            extension.config = {**(extension.config or {}), "config": str(args.config.resolve())}
    Server((args.host, args.port), app).start()


if __name__ == "__main__":
    main()
