#!/usr/bin/env bash
# Cihaz ici dogal Türkçe ses icin gereken iki buyuk parcayi indirir:
#   - sherpa-onnx (ses motorunu calistiran kutuphane, AAR)
#   - Supertonic 3 (31 dilli, 10 sesli nöral ses modeli; Türkçe dahil)
# Bunlar depoya konmaz (toplam ~190 MB); hem CI hem de yerel derleme oncesinde
# bu betik calistirilir.
set -euo pipefail

SHERPA_VERSION="1.13.8"
MODEL="sherpa-onnx-supertonic-3-tts-int8-2026-05-11"

here="$(cd "$(dirname "$0")/.." && pwd)"
libs="$here/app/libs"
assets="$here/app/src/main/assets"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$libs"
# Eski (Piper) ses paketinin kalintilari varsa temizlensin.
rm -rf "$assets/tts" "$assets/espeak-ng-data" "$assets/supertonic"
mkdir -p "$assets/supertonic"

echo "-> sherpa-onnx $SHERPA_VERSION (AAR)"
curl -fsSL -o "$libs/sherpa-onnx.aar" \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/v$SHERPA_VERSION/sherpa-onnx-$SHERPA_VERSION.aar"

echo "-> Supertonic 3 ses modeli"
curl -fsSL -o "$work/model.tar.bz2" \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$MODEL.tar.bz2"
tar xjf "$work/model.tar.bz2" -C "$work"

for f in duration_predictor.int8.onnx text_encoder.int8.onnx vector_estimator.int8.onnx \
         vocoder.int8.onnx tts.json unicode_indexer.bin voice.bin LICENSE; do
  cp "$work/$MODEL/$f" "$assets/supertonic/$f"
done

echo "hazir:"
du -sh "$libs/sherpa-onnx.aar" "$assets/supertonic"
