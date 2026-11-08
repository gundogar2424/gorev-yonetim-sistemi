# replikler.py'deki her cümleyi doğal Türkçe sesle (Supertonic 3) seslendirir,
# cikti/tts/lineN.npy olarak kaydeder ve zaman çakışmalarını yazdırır.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from ses_motoru import engine, say
from replikler import LINES

out = os.path.join(HERE, 'cikti', 'tts'); os.makedirs(out, exist_ok=True)
tts = engine(); prev = 0
for i, (st, sid, sp, txt) in enumerate(LINES):
    x, sr = say(tts, txt, sid, sp, steps=10)
    idx = np.where(np.abs(x) > 0.01)[0]; x = x[max(0, idx[0] - 300):idx[-1] + 2000]
    np.save(os.path.join(out, f'line{i}.npy'), x)
    d = len(x) / sr
    print(f'{i:2d} {st:5.2f}-{st + d:5.2f} {"ÇAKIŞMA" if st < prev - 0.1 else ""} {txt}')
    prev = st + d
