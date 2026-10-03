import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { lzDb } from "../db";
import type { LzMekan } from "../types";
import { Header, T_BASLIK, T_GOVDE, T_SOLUK, Thumb } from "../components/ui";
import { apiAnahtari } from "../lib/ai";
import { linkAyikla } from "../lib/importer";
import {
  puanYaz,
  adrestenKonum,
  konumReddedildi,
  konumReddiniKaydet,
  mekanLinktenEkle,
  mesafeKm,
  mesafeYaz,
  telefonKonumu,
  type Konum,
} from "../lib/mekan";

const YAKIN_KM = 3;

// Son kullanilan konum (telefon ya da yazilan semt) ekranlar arasi korunur
let sonKonum: Konum | null = null;

// MEKANLARIM: internette gorulen yeme-icme yerleri. Yakinimdakiler en ustte.
export default function Mekanlar() {
  const navigate = useNavigate();
  const liste =
    useLiveQuery(
      () => lzDb.mekanlar.orderBy("createdAt").reverse().toArray(),
      [],
      [] as LzMekan[]
    ) ?? [];
  const [konum, setKonum] = useState<Konum | null>(sonKonum);
  const [konumMesaj, setKonumMesaj] = useState("");
  const [semt, setSemt] = useState("");
  const [link, setLink] = useState("");
  const [ekleniyor, setEkleniyor] = useState("");
  const [hata, setHata] = useState("");
  const [arama, setArama] = useState("");
  const [sadeceGidilmedi, setSadeceGidilmedi] = useState(false);
  const [etiket, setEtiket] = useState("");
  const [yaricap, setYaricap] = useState(0); // 0 = hepsi
  const [siralama, setSiralama] = useState<"mesafe" | "puan">("mesafe");
  const aiVar = !!apiAnahtari();

  const konumuAl = async () => {
    setKonumMesaj("Konum alınıyor…");
    try {
      const k = await telefonKonumu();
      sonKonum = { ...k, ad: "Bulunduğun yer" };
      setKonum(sonKonum);
      setKonumMesaj("");
    } catch (e) {
      setKonumMesaj(`${(e as Error).message} İstersen bulunduğun semti yaz.`);
    }
  };

  // Ekran acilinca konum kendiliginden alinir (ilk seferde telefon izin sorar)
  useEffect(() => {
    if (!sonKonum) void konumuAl();
  }, []);

  const semtBul = async () => {
    setKonumMesaj("Semt aranıyor…");
    const k = await adrestenKonum(semt);
    if (!k) {
      setKonumMesaj(
        "Bu semt bulunamadı; ilçe ve şehirle dene (ör. “Moda, Kadıköy, İstanbul”)."
      );
      return;
    }
    sonKonum = { ...k, ad: semt.trim() };
    setKonum(sonKonum);
    setKonumMesaj("");
  };

  const ekle = async () => {
    setHata("");
    try {
      const { id, yeni } = await mekanLinktenEkle(link.trim(), setEkleniyor);
      setLink("");
      navigate(`/mekan/${id}`, {
        state: yeni ? undefined : { zatenVar: true },
      });
    } catch (e) {
      setHata((e as Error).message);
    }
    setEkleniyor("");
  };

  // Kayitli mekanlardaki etiketler (cok kullanilan once)
  const sayac = new Map<string, number>();
  liste.forEach((m) =>
    m.etiketler.forEach((e) => sayac.set(e, (sayac.get(e) ?? 0) + 1))
  );
  const tumEtiketler = [...sayac.entries()].sort((a, b) => b[1] - a[1]);
  const q = arama.trim().toLocaleLowerCase("tr");
  const suzulmus = liste.filter(
    (m) =>
      (!sadeceGidilmedi || !m.gidildi) &&
      (!etiket || m.etiketler.includes(etiket)) &&
      (!yaricap ||
        (konum &&
          m.lat !== undefined &&
          m.lon !== undefined &&
          mesafeKm(konum, { lat: m.lat, lon: m.lon }) <= yaricap)) &&
      (!q ||
        `${m.ad} ${m.tur} ${m.ilce} ${m.sehir} ${m.oneriler.join(
          " "
        )} ${m.etiketler.join(" ")}`
          .toLocaleLowerCase("tr")
          .includes(q))
  );
  const mesafe = (m: LzMekan) =>
    konum && m.lat !== undefined && m.lon !== undefined
      ? mesafeKm(konum, { lat: m.lat, lon: m.lon })
      : undefined;
  const sirali =
    siralama === "puan"
      ? [...suzulmus].sort((a, b) => (b.puan ?? 0) - (a.puan ?? 0))
      : konum
      ? [...suzulmus].sort((a, b) => (mesafe(a) ?? 1e9) - (mesafe(b) ?? 1e9))
      : suzulmus;
  const yakinlar = konum
    ? sirali.filter((m) => (mesafe(m) ?? 1e9) <= YAKIN_KM)
    : [];

  return (
    <div>
      <Header
        title="Mekanlarım"
        subtitle={
          liste.length
            ? `${liste.length} yeme-içme mekanı`
            : "Gördüğün mekanları kaydet"
        }
        back
      />
      <div className="px-4 space-y-3 pb-8">
        {/* Nerede oldugun */}
        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>
            📍 {konum ? `Konum: ${konum.ad ?? "Bulunduğun yer"}` : "Neredesin?"}
          </div>
          {konum && (
            <p className={`text-[13px] ${T_GOVDE}`}>
              {yakinlar.length
                ? `${YAKIN_KM} km içinde kayıtlı ${yakinlar.length} mekan var 👇`
                : `${YAKIN_KM} km içinde kayıtlı mekan yok; en yakınlar aşağıda.`}
            </p>
          )}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              className="lz-btn-primary px-3 text-[13px]"
              onClick={() => void konumuAl()}
            >
              Konumumu bul
            </button>
            <div className="flex gap-1.5">
              <input
                className="lz-input py-2 text-[14px] min-w-0"
                placeholder="konum kapalıysa semt"
                value={semt}
                onChange={(e) => setSemt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void semtBul()}
              />
              <button
                className="lz-btn-soft px-3 text-[13px]"
                disabled={!semt.trim()}
                onClick={() => void semtBul()}
              >
                Bul
              </button>
            </div>
          </div>
          {konumMesaj && (
            <p className={`text-[12.5px] ${T_SOLUK}`}>{konumMesaj}</p>
          )}
          <button
            className="lz-btn-primary w-full text-[15px]"
            onClick={async () => {
              if (!konum) await konumuAl();
              setYaricap(yaricap || YAKIN_KM);
              setTimeout(
                () =>
                  document
                    .getElementById("mekan-listesi")
                    ?.scrollIntoView({ behavior: "smooth" }),
                100
              );
            }}
          >
            📍 Yakınımdaki mekanları göster
          </button>
          {yaricap > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {[1, 3, 5, 10, 0].map((km) => (
                <button
                  key={km}
                  className={`lz-chip text-[12.5px] ${
                    yaricap === km ? "lz-chip-on" : ""
                  }`}
                  onClick={() => setYaricap(km)}
                >
                  {km ? `${km} km` : "Hepsi"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Yeni mekan */}
        <div className="lz-card p-4 space-y-2.5">
          <div className={`font-semibold ${T_BASLIK}`}>Mekan ekle</div>
          <p className={`text-[12.5px] ${T_SOLUK}`}>
            Instagram, TikTok, YouTube ya da Google Haritalar linkini yapıştır;
            ya da sadece adını ve semtini yaz (“Karaköy Lokantası, İstanbul”).
            Konum yazmasa da yapay zeka Google’da araştırıp yerini kendisi
            bulur. En kolayı: Instagram’da Paylaş → Lezzet Defteri; hiçbir şey
            yazmana gerek yok.
          </p>
          <textarea
            className="lz-input min-h-[60px] text-[14px]"
            placeholder="Link ya da mekan adı + semt"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button
            className="lz-btn-primary w-full"
            disabled={!aiVar || !link.trim() || !!ekleniyor}
            onClick={() => void ekle()}
          >
            {ekleniyor ||
              (linkAyikla(link) ? "Mekanı kaydet" : "Mekanı araştır ve kaydet")}
          </button>
          {!aiVar && (
            <p className="text-[12.5px] text-rose-600 dark:text-rose-300">
              Bunun için{" "}
              <Link to="/ayarlar" className="underline font-semibold">
                Ayarlar
              </Link>
              ’dan Gemini anahtarı gerekli.
            </p>
          )}
          {hata && (
            <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3">
              ⚠️ {hata}
            </div>
          )}
        </div>

        {liste.length > 0 && (
          <>
            <div id="mekan-listesi" className="space-y-2 scroll-mt-24">
              <input
                className="lz-input py-2 text-[14px] w-full"
                placeholder="Ara: ad, semt, yemek…"
                value={arama}
                onChange={(e) => setArama(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className={`lz-chip whitespace-nowrap ${
                    sadeceGidilmedi ? "lz-chip-on" : ""
                  }`}
                  onClick={() => setSadeceGidilmedi(!sadeceGidilmedi)}
                >
                  Gitmediklerim
                </button>
                <button
                  className="lz-chip whitespace-nowrap"
                  onClick={() =>
                    setSiralama(siralama === "puan" ? "mesafe" : "puan")
                  }
                >
                  {siralama === "puan" ? "⭐ Puana göre" : "📍 Yakına göre"}
                </button>
              </div>
            </div>
            {tumEtiketler.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
                {tumEtiketler.map(([e, n]) => (
                  <button
                    key={e}
                    className={`lz-chip whitespace-nowrap flex-shrink-0 text-[12.5px] ${
                      etiket === e ? "lz-chip-on" : ""
                    }`}
                    onClick={() => setEtiket(etiket === e ? "" : e)}
                  >
                    {e} <span className="opacity-60 ml-0.5">{n}</span>
                  </button>
                ))}
              </div>
            )}
            {yaricap > 0 && sirali.length === 0 && (
              <div className={`lz-card p-5 text-center text-sm ${T_GOVDE}`}>
                {yaricap} km içinde kayıtlı mekan yok. Mesafeyi büyüt ya da
                “Hepsi”ni seç.
              </div>
            )}
            {sirali.map((m) => {
              const km = mesafe(m);
              return (
                <Link
                  key={m.id}
                  to={`/mekan/${m.id}`}
                  className={`lz-card p-3 flex gap-3 ${
                    km !== undefined && km <= YAKIN_KM
                      ? "ring-2 ring-lz-500/60"
                      : ""
                  }`}
                >
                  <Thumb
                    src={m.foto}
                    className="w-16 h-16 rounded-2xl"
                    emoji="🍽️"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold leading-snug ${T_BASLIK}`}>
                      {m.ad}{" "}
                      {m.gidildi && <span className="text-[12px]">✅</span>}
                    </div>
                    <div className={`text-[12.5px] ${T_SOLUK}`}>
                      {m.puan ? (
                        <b className="text-amber-600 dark:text-amber-300 font-semibold">
                          {puanYaz(m)} ·{" "}
                        </b>
                      ) : null}
                      {[m.tur, m.ilce, m.sehir].filter(Boolean).join(" · ")}
                    </div>
                    {m.oneriler.length > 0 && (
                      <div className={`text-[12.5px] truncate ${T_GOVDE}`}>
                        😋 {m.oneriler.slice(0, 3).join(", ")}
                      </div>
                    )}
                    {m.etiketler.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.etiketler.slice(0, 4).map((e) => (
                          <span
                            key={e}
                            className="lz-pill !text-[11px] !py-0.5"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {km !== undefined && (
                    <div className="text-[12.5px] font-semibold text-lz-600 whitespace-nowrap self-center">
                      {mesafeYaz(km)}
                    </div>
                  )}
                  {m.lat === undefined && (
                    <div className={`text-[11px] self-center ${T_SOLUK}`}>
                      yer?
                    </div>
                  )}
                </Link>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// Tariflerim ustunde: konum izni daha once verildiyse yakindaki mekanlar icin serit
export function YakinMekanSeridi() {
  const sayi = useLiveQuery(() => lzDb.mekanlar.count(), [], 0) ?? 0;
  const [yakin, setYakin] = useState(0);
  useEffect(() => {
    // Kayitli mekan varsa konum kendiliginden alinir (izin bir kez sorulur; reddedilirse bir daha sorulmaz)
    if (!sayi || konumReddedildi()) return;
    let iptal = false;
    void (async () => {
      try {
        const k = sonKonum ?? (await telefonKonumu(8000));
        sonKonum = sonKonum ?? { ...k, ad: "Bulunduğun yer" };
        const hepsi = await lzDb.mekanlar.toArray();
        const n = hepsi.filter(
          (m) =>
            m.lat !== undefined &&
            m.lon !== undefined &&
            !m.gidildi &&
            mesafeKm(k, { lat: m.lat, lon: m.lon }) <= YAKIN_KM
        ).length;
        if (!iptal) setYakin(n);
      } catch (e) {
        if (/izin/i.test((e as Error).message)) konumReddiniKaydet();
      }
    })();
    return () => {
      iptal = true;
    };
  }, [sayi]);
  if (!yakin) return null;
  return (
    <Link
      to="/mekanlar"
      className="lz-card p-3 flex items-center gap-3 ring-2 ring-lz-500/50"
    >
      <span className="text-lg">📍</span>
      <span className={`flex-1 text-[13.5px] font-medium ${T_BASLIK}`}>
        Yakınında kayıtlı {yakin} mekan var
      </span>
      <span className="text-lz-600 text-[13px] font-semibold">Göster</span>
    </Link>
  );
}
