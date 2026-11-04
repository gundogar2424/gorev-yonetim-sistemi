#!/usr/bin/env bash
# Videoyu baştan üretir: ses modeli -> seslendirme -> müzik/efekt miksi -> kareler -> MP4
# Gerekenler: python3 (numpy), node + playwright (chromium), ffmpeg
set -euo pipefail
cd "$(dirname "$0")"
MODEL=sherpa-onnx-supertonic-3-tts-int8-2026-05-11
SURE=41; FPS=30; ISCI=${ISCI:-4}

python3 -c "import sherpa_onnx" 2>/dev/null || pip install sherpa-onnx numpy
if [ ! -d "model/$MODEL" ]; then
  echo "-> ses modeli indiriliyor (~140 MB)"
  mkdir -p model
  curl -fsSL -o model/m.tar.bz2 "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$MODEL.tar.bz2"
  tar xjf model/m.tar.bz2 -C model && rm model/m.tar.bz2
fi

echo "-> seslendirme"; python3 seslendir.py
echo "-> müzik + efekt + ses miksi"; python3 muzik_ve_miks.py

echo "-> kareler ($ISCI paralel işçi)"
rm -rf cikti/kareler && mkdir -p cikti/kareler
PIDS=()
for w in $(seq 0 $((ISCI - 1))); do node kareler.cjs "$PWD/animasyon.html" "$PWD/cikti/kareler" $SURE $FPS $w $ISCI & PIDS+=($!); done
for pid in "${PIDS[@]}"; do wait "$pid" || { echo "HATA: kare çizimi başarısız" >&2; exit 1; }; done

echo "-> MP4"
ffmpeg -loglevel error -y -framerate $FPS -i cikti/kareler/f%05d.png -i cikti/ses.wav \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -c:a aac -b:a 192k -shortest -movflags +faststart balikcioglu-duvar.mp4
rm -rf cikti/kareler
echo "hazır: balikcioglu-duvar.mp4"
