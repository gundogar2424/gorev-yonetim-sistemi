#!/usr/bin/env bash
# Cihaz ici nöral Türkçe ses için gereken iki büyük dosyayi indirir.
# Bunlar depoya konmaz (toplam ~130 MB); hem CI hem de yerel derleme
# oncesinde bu betik calistirilir.
set -euo pipefail

SHERPA_VERSION="1.13.2"
MODEL="vits-piper-tr_TR-dfki-medium"

here="$(cd "$(dirname "$0")/.." && pwd)"
libs="$here/app/libs"
assets="$here/app/src/main/assets"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$libs" "$assets/tts" "$assets/espeak-ng-data"

echo "-> sherpa-onnx $SHERPA_VERSION (AAR)"
curl -fsSL -o "$libs/sherpa-onnx.aar" \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/v$SHERPA_VERSION/sherpa-onnx-$SHERPA_VERSION.aar"

echo "-> Türkçe ses modeli ($MODEL)"
curl -fsSL -o "$work/model.tar.bz2" \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$MODEL.tar.bz2"
tar xjf "$work/model.tar.bz2" -C "$work"

cp "$work/$MODEL/tr_TR-dfki-medium.onnx" "$assets/tts/model.onnx"
cp "$work/$MODEL/tokens.txt" "$assets/tts/tokens.txt"

# espeak-ng verisi tum dilleri icerir (19 MB); yalnizca Türkçe için
# gerekenler alinir (~3 MB). en_dict yedek olarak durur.
src="$work/$MODEL/espeak-ng-data"
dst="$assets/espeak-ng-data"
cp "$src/phondata" "$src/phondata-manifest" "$src/phonindex" \
   "$src/phontab" "$src/intonations" "$src/tr_dict" "$src/en_dict" "$dst/"
cp -r "$src/lang" "$src/voices" "$dst/"

echo "hazir:"
du -sh "$libs/sherpa-onnx.aar" "$assets/tts" "$assets/espeak-ng-data"
