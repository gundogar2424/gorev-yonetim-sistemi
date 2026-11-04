import numpy as np, wave, sys
import os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from replikler import LINES
SR = 44100; T = 41.0; N = int(SR * T)
rng = np.random.default_rng(3)
music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); voice = np.zeros(N)

def add(buf, t, x, gain=1.0, pan=0.0):
    i = int(t * SR); x = x[:max(0, len(buf) - i)]
    if buf.ndim == 1: buf[i:i + len(x)] += x * gain
    else:
        buf[i:i + len(x), 0] += x * gain * (1 - pan) ** .5
        buf[i:i + len(x), 1] += x * gain * (1 + pan) ** .5
def tt(d): return np.arange(int(d * SR)) / SR
def env(d, a=.005, decay=8.0):
    t = tt(d); return np.minimum(1, t / a) * np.exp(-t * decay)
def hz(n): return 440 * 2 ** ((n - 69) / 12)
def smooth(x, k):
    return np.convolve(x, np.ones(k) / k, 'same')

# ---------- enstrümanlar ----------
def pluck(n, d=.5):
    t = tt(d); f = hz(n)
    return (np.sin(2*np.pi*f*t) + .35*np.sin(4*np.pi*f*t) + .12*np.sin(6*np.pi*f*t)) * env(d, .003, 7)
def pad(notes, d):
    t = tt(d); x = sum(np.sin(2*np.pi*hz(n)*t) + .5*np.sin(2*np.pi*hz(n)*1.003*t) for n in notes)
    e = np.minimum(1, t / .25) * np.minimum(1, (d - t) / .3)
    return x * e / len(notes)
def bass(n, d=.4):
    t = tt(d); f = hz(n); return (np.sin(2*np.pi*f*t) + .25*np.sin(4*np.pi*f*t)) * env(d, .004, 6)
def kick():
    t = tt(.3); f = 50 + 90 * np.exp(-t * 30); return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 9)
def hat():
    x = rng.standard_normal(int(.05*SR)); x = np.diff(x, prepend=0); return x * env(.05, .001, 70) * .5
def clap():
    x = rng.standard_normal(int(.18*SR)); x = x - smooth(x, 6); return x * env(.18, .002, 22) * .6
def bell(f, d=1.2, dec=4):
    t = tt(d); return (np.sin(2*np.pi*f*t) + .5*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*6) + .25*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*10)) * env(d, .002, dec)
def whoosh(d=.6, rev=False):
    x = rng.standard_normal(int(d*SR)); x = smooth(x, 9) - smooth(x, 60)
    t = tt(d); e = np.sin(np.pi * t / d) ** 2
    return x * e * 1.6
def pop(f0=300, f1=900, d=.12):
    t = tt(d); f = np.linspace(f0, f1, len(t)); return np.sin(2*np.pi*np.cumsum(f)/SR) * env(d, .002, 30)
def thud(f=70, d=.25):
    t = tt(d); x = np.sin(2*np.pi*np.cumsum(f + 60*np.exp(-t*40))/SR) * np.exp(-t*18)
    n = rng.standard_normal(len(t)) * np.exp(-t*60) * .3; return x + n
def knock():
    t = tt(.08); return (np.sin(2*np.pi*520*t) * .6 + smooth(rng.standard_normal(len(t)), 4)) * np.exp(-t*60)

# ---------- müzik ----------
BPM = 112; B = 60 / BPM
CH = [(60, [60, 64, 67, 72], 48), (55, [55, 59, 62, 67], 43), (57, [57, 60, 64, 69], 45), (53, [53, 57, 60, 65], 41)]
def groove(t0, t1, full=True, gain=1.0):
    beat = 0; t = t0
    while t < t1 - 1e-6:
        bar = int(beat // 4); root, ch, bn = CH[bar % 4]; b4 = beat % 4
        if b4 == 0: add(music, t, pad([n - 12 for n in ch[:3]] + [ch[1]], min(4 * B, t1 - t)), .10 * gain)
        add(music, t, pluck(ch[(beat * 2) % 4] + 12, .45), .14 * gain, -.3)
        add(music, t + B / 2, pluck(ch[(beat * 2 + 1) % 4] + 12, .45), .11 * gain, .3)
        if full:
            add(music, t, bass(bn, B * .9), .30 * gain)
            if b4 == 2: add(music, t + B * .5, bass(bn + 7, B * .45), .2 * gain)
            if b4 in (0, 2): add(music, t, kick(), .42 * gain)
            if b4 in (1, 3): add(music, t, clap(), .16 * gain)
            add(music, t + B / 2, hat(), .12 * gain, .4)
        beat += 1; t = t0 + beat * B

groove(0.0, 6.7, full=False, gain=.9)            # sakin giriş
# hafif şaşkınlık: iki yumuşak nota ("hımm")
add(music, 6.9, pluck(67, .9), .16); add(music, 7.25, pluck(63, 1.2), .16)
add(music, 6.9, pad([51, 55, 58], 2.2), .08)
# fikir -> yükselen hareket
for k in range(8): add(music, 9.1 + k * .18, pluck(60 + [0, 4, 7, 12, 16, 19, 24, 28][k], .4), .14, (k % 2) * .6 - .3)
groove(10.75, 32.0, full=True)                   # ana ritim
# final
add(music, 32.0, pad([48, 55, 64, 67, 72], 8.5), .22)
add(music, 32.0, kick(), .5); add(music, 32.0, bass(36, 2.0), .35)
for k, n in enumerate([72, 76, 79, 84]): add(music, 32.05 + k * .09, pluck(n, 1.0), .15)
fade = np.ones(N); fi = int(39.3 * SR); fade[fi:] = np.linspace(1, 0, N - fi); music *= fade[:, None]

# ---------- efektler ----------
add(sfx, 2.8, pop(250, 700, .18), .35)                       # düşünce balonu
for k in range(4): add(sfx, 5.8 + k * .2, np.sin(2*np.pi*(1400 if k % 2 == 0 else 1750)*tt(.16)) * env(.16, .005, 12), .12)  # telefon
add(sfx, 9.0, bell(1318.5, 1.4), .28)                        # ampul
add(sfx, 10.6, whoosh(.55), .25); add(sfx, 16.8, whoosh(.55), .25); add(sfx, 31.9, whoosh(.6), .3)
for a in (12.0, 13.5, 15.0):                                  # seçim tiki
    add(sfx, a, bell(1568, .5, 9), .2); add(sfx, a + .09, bell(2093, .7, 8), .18)
for i in range(3): add(sfx, 17.3 + i * .18 + .26, thud(), .45)   # kutular yere
for a in (18.75, 22.15, 22.95, 25.55): add(sfx, a, thud(85, .3), .55); add(sfx, a + .02, knock(), .12)
add(sfx, 26.05, bell(2637, 1.0, 4), .10, .5); add(sfx, 26.15, bell(3520, 1.0, 4), .08, .5)  # mermer parlaması
for i in range(4): add(sfx, 28.7 + i * .3, pop(500, 900, .08), .15)
add(sfx, 29.9, whoosh(.3), .25)
for k in range(6): add(sfx, 28.2 + k * .08, bell(hz(84 + [0, 4, 7, 12, 16, 19][k]), .6, 7), .08, (k % 3 - 1) * .5)
cash = bell(2637, .9, 5) * .8 + bell(3136, .9, 5) * .6                   # ka-çing
add(sfx, 30.3, smooth(rng.standard_normal(int(.07*SR)), 3) * env(.07, .001, 50), .3); add(sfx, 30.35, cash, .18)
for k, n in enumerate([76, 79, 84]): add(sfx, 29.0 + k * .1, bell(hz(n), .8, 6), .07)
for i in range(3): add(sfx, 34.4 + i * .5, pop(500, 1200, .1), .15)

# ---------- ses ----------
vmask = np.zeros(N)
prev_end = 0.0
for i, (st, sid, sp, txt) in enumerate(LINES):
    x = np.load(os.path.join(HERE, 'cikti', 'tts', f'line{i}.npy')); x = x / (np.abs(x).max() + 1e-9) * .85
    # Ses modeli her seferinde biraz farklı süre üretir: öncekiyle çakışacaksa replik biraz ileri kayar.
    if st < prev_end + .08:
        print(f'  replik {i} {st:.2f} -> {prev_end + .08:.2f} sn kaydırıldı (çakışmasın diye)')
        st = prev_end + .08
    add(voice, st, x, 1.0); vmask[int(st*SR):int(st*SR) + len(x)] = 1
    prev_end = st + len(x) / SR
duck = 1 - .55 * smooth(vmask, int(.15 * SR))
music *= duck[:, None]
mix = music + sfx + voice[:, None] * .95
mix /= np.abs(mix).max() / .92
with wave.open(os.path.join(HERE, 'cikti', 'ses.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('ok', mix.shape[0] / SR, 's')
