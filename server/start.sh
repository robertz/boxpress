#!/usr/bin/env bash
# BoxLang (1.18+) picks up .env and .boxlang.json from the directory it's run
# in, so start from server/ wherever this was called from.
cd "$(dirname "$0")"
exec boxlang server.bxs
