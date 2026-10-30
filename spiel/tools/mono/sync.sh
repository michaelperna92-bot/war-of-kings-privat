#!/bin/sh
# Baut das gemeinsame Repository /home/claude/war-of-kings aus den beiden Arbeitsprojekten (nur versionierte Dateien + Web-Build).
set -e
M=/home/claude/war-of-kings; G=/home/claude/wokgame; C=/home/claude/cc
mkdir -p "$M"; [ -d "$M/.git" ] || git -C "$M" init -q -b main
rm -rf "$M/spiel" "$M/kartenwerkstatt"; mkdir -p "$M/spiel" "$M/kartenwerkstatt"
(cd "$G" && git ls-files -z | xargs -0 -I{} cp --parents {} "$M/spiel/")
(cd "$G" && cp -r --parents dist/web server/vendor "$M/spiel/")
(cd "$C" && git ls-files -z | xargs -0 -I{} cp --parents {} "$M/kartenwerkstatt/")
cp "$G/tools/mono/README.md" "$G/tools/mono/render.yaml" "$M/"; cp "$G/CLAUDE.md" "$M/CLAUDE.md"
printf 'release/\nnode_modules/\n' > "$M/.gitignore"
echo "fertig: $M"
