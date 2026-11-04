import sherpa_onnx, numpy as np, wave
import os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model', 'sherpa-onnx-supertonic-3-tts-int8-2026-05-11') + '/'
def engine():
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
            duration_predictor=D+'duration_predictor.int8.onnx', text_encoder=D+'text_encoder.int8.onnx',
            vector_estimator=D+'vector_estimator.int8.onnx', vocoder=D+'vocoder.int8.onnx',
            tts_json=D+'tts.json', unicode_indexer=D+'unicode_indexer.bin', voice_style=D+'voice.bin'),
        num_threads=4), max_num_sentences=1)
    return sherpa_onnx.OfflineTts(cfg)
def say(tts, text, sid, speed=1.0, steps=8):
    g = sherpa_onnx.GenerationConfig(); g.sid = sid; g.speed = speed; g.num_steps = steps; g.extra = {"lang": "tr"}
    a = tts.generate(text, g); return np.array(a.samples, dtype=np.float32), a.sample_rate
def f0(x, sr):
    fr = int(sr*.04); vals = []
    for i in range(0, len(x)-fr, fr):
        s = x[i:i+fr]
        if np.sqrt((s**2).mean()) < .03: continue
        c = np.correlate(s, s, 'full')[fr-1:]; lo, hi = int(sr/400), int(sr/70)
        vals.append(sr/(lo+np.argmax(c[lo:hi])))
    return np.median(vals) if vals else 0
