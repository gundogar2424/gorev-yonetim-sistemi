#!/usr/bin/env python3
"""capacitor-health-extended eklentisinin uyku toplamasini duzeltir.

SORUN
-----
Eklentinin aggregateSleepSessions fonksiyonu bir gecenin suresini soyle
hesapliyor:

    val totalSeconds = sessions.sumOf { it.endTime.epochSecond - it.startTime.epochSecond }

Bunun iki hatasi var:

1. `endTime - startTime` = YATAKTA GECEN sure. SleepSessionRecord icindeki
   "awake" evreleri dusulmuyor. Samsung Health ekraninda gorunen sayi ise
   bunlar dusulmus hali. Bu yuzden uygulamamiz surekli daha uzun bir uyku
   gosteriyordu (orn. Samsung 8,6 sa derken biz 10,1 sa).
2. Ayni geceyi birden fazla kaynak yazabiliyor (Galaxy Watch + telefon).
   `sumOf` ikisini de topluyor, ust uste binen sureleri tekillestirmiyor.

COZUM
-----
Sureyi evre bazinda ve ust uste binmeleri birlestirerek hesapla:
  - Oturumun evreleri varsa yalnizca gercekten UYKU olan evreleri al
    (SLEEPING / LIGHT / DEEP / REM). AWAKE, AWAKE_IN_BED, OUT_OF_BED disarida
    kalir. Beyaz liste kullaniyoruz; boylece kutuphanenin yeni surumlerinde
    eklenen bir evre turu yanlislikla "uyku" sayilmaz.
  - Evre bilgisi hic yoksa (bazi kaynaklar yazmiyor) oturumun tamamini al —
    elimizdeki tek bilgi o.
  - Butun araliklari sirala ve BIRLESTIR; ust uste binen kisim bir kez sayilir.
    Iki kaynagin ayni geceyi yazmasi artik sureyi iki katina cikarmaz.

Neden node_modules'u yamaliyoruz: eklenti ham uyku kayitlarini JS tarafina hic
acmiyor (yalnizca toplanmis tek bir sayi donuyor), dolayisiyla bu hesabi
uygulama tarafinda yapmak mumkun degil. Ayni dosyaya CI'da zaten baska iki
yama uygulaniyor (apk.yml icindeki sed'ler).
"""

import pathlib
import sys

ROOT = pathlib.Path("node_modules/@flomentumsolutions/capacitor-health-extended/android/src/main/java")

OLD = "                val totalSeconds = sessions.sumOf { it.endTime.epochSecond - it.startTime.epochSecond }"

NEW = """                // YAMA (tools/patch-sleep-aggregation.py): yatakta gecen sure yerine
                // gercek uyku. Uyanik evreler dusuluyor, ust uste binen kayitlar
                // (saat + telefon ayni geceyi yazdiginda) bir kez sayiliyor.
                val spans = ArrayList<Pair<Long, Long>>()
                for (s in sessions) {
                    val asleep = s.stages.filter { st ->
                        st.stage == SleepSessionRecord.STAGE_TYPE_SLEEPING ||
                            st.stage == SleepSessionRecord.STAGE_TYPE_LIGHT ||
                            st.stage == SleepSessionRecord.STAGE_TYPE_DEEP ||
                            st.stage == SleepSessionRecord.STAGE_TYPE_REM
                    }
                    if (asleep.isEmpty()) {
                        spans.add(Pair(s.startTime.epochSecond, s.endTime.epochSecond))
                    } else {
                        asleep.forEach { st ->
                            spans.add(Pair(st.startTime.epochSecond, st.endTime.epochSecond))
                        }
                    }
                }
                spans.sortBy { it.first }
                var totalSeconds = 0L
                var curStart = -1L
                var curEnd = -1L
                for (sp in spans) {
                    if (curEnd < 0L) {
                        curStart = sp.first
                        curEnd = sp.second
                    } else if (sp.first <= curEnd) {
                        if (sp.second > curEnd) curEnd = sp.second
                    } else {
                        totalSeconds += curEnd - curStart
                        curStart = sp.first
                        curEnd = sp.second
                    }
                }
                if (curEnd >= 0L) totalSeconds += curEnd - curStart"""


def main() -> int:
    files = list(ROOT.rglob("HealthPlugin.kt"))
    if not files:
        print("HATA: HealthPlugin.kt bulunamadi", file=sys.stderr)
        return 1

    path = files[0]
    src = path.read_text(encoding="utf-8")

    if "patch-sleep-aggregation.py" in src:
        print(f"Yama zaten uygulanmis: {path}")
        return 0

    if src.count(OLD) != 1:
        # Sessizce gecmiyoruz: eklenti guncellendiyse yama tutmamis demektir ve
        # uygulama yine yanlis uyku suresi gosterir. Derleme burada dursun.
        print(
            f"HATA: beklenen satir {src.count(OLD)} kez bulundu (1 olmaliydi).\n"
            f"Dosya: {path}\nAranan:\n{OLD}",
            file=sys.stderr,
        )
        return 1

    path.write_text(src.replace(OLD, NEW), encoding="utf-8")
    print(f"Uyku toplama yamasi uygulandi: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
