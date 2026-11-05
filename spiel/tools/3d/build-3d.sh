#!/bin/sh
# erzeugt assets/3d/three-bundle.js und kopiert gsap.min.js (Quellen: github.com/mrdoob/three.js r169, github.com/greensock/GSAP 3.12.5)
set -e
D=$(cd "$(dirname "$0")" && pwd); T=/home/claude/mrdoob/three.js; G=/tmp/claude-0/gsap313
mkdir -p "$D/../../assets/3d"
ESB=/opt/npm-tools/node_modules/esbuild/bin/esbuild
$ESB "$D/entry.js" --bundle --minify --format=iife --legal-comments=none --alias:three=$T/build/three.module.js --alias:three/examples/jsm=$T/examples/jsm --outfile="$D/../../assets/3d/three-bundle.js"
cp $G/dist/gsap.min.js "$D/../../assets/3d/gsap.min.js"
cp $T/LICENSE "$D/../../assets/3d/LICENSE-three.txt"
ls -la "$D/../../assets/3d"
