import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const DATA_FILE = "./data.json";

// =====================
// HELPERS
// =====================
function cleanNumber(text) {
  if (!text) return null;
  const n = text.replace(/\D/g, "");
  return n ? Number(n) : null;
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ listings: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =====================
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
  res.json({ ok: true, message: "API ayakta" });
});

// =====================
// ANALYZE
// =====================
app.post("/api/analyze", async (req, res) => {
  try {
    const { ilanNo, price, brand, model, year, km } = req.body || {};

    if (!ilanNo || !price || !brand || !model || !year) {
      return res.json({
        success: false,
        message: "Gerekli veriler eksik"
      });
    }

    const listing = {
      ilanNo: String(ilanNo),
      price,
      brand,
      model,
      year,
      km: km || null,
      createdAt: Date.now()
    };

    const db = loadData();
    const exists = db.listings.find(l => l.ilanNo === listing.ilanNo);

    if (!exists) {
      db.listings.push(listing);
      saveData(db);
    }

    // =====================
    // HAVUZ (AYNI ARAÇ)
    // =====================
    const pool = db.listings.filter(l =>
      l.brand === listing.brand &&
      l.model === listing.model &&
      l.year === listing.year
    );

    if (!pool.length) {
      return res.json({
        success: false,
        message: "Piyasa havuzu yok"
      });
    }

    // =====================
    // HİBRİT PİYASA
    // =====================
    const prices = pool.map(l => l.price).sort((a, b) => a - b);
    const median =
      prices.length % 2 === 0
        ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
        : prices[Math.floor(prices.length / 2)];

    const average =
      prices.reduce((s, p) => s + p, 0) / prices.length;

    const baseMarketPrice = Math.round((median + average) / 2);

    // =====================
    // ✅ KM NORMALİZASYONU (DÜZELTİLDİ)
    // =====================
    let adjustedMarketPrice = baseMarketPrice;

    if (listing.km) {
      const kmList = pool
        .map(l => l.km)
        .filter(v => typeof v === "number");

      if (kmList.length) {
        const referenceKm =
          kmList.reduce((s, v) => s + v, 0) / kmList.length;

        const kmDiff = listing.km - referenceKm;

        // 🔥 HER 10.000 KM İÇİN %2 ETKİ
        const kmEffectPer10k = 0.02;

        // 🔴 KRİTİK DÜZELTME: EKSİ İŞARETİ
        let kmMultiplier =
          1 - (kmDiff / 10000) * kmEffectPer10k;

        // güvenlik sınırı
        kmMultiplier = Math.max(0.7, Math.min(1.3, kmMultiplier));

        adjustedMarketPrice = Math.round(
          baseMarketPrice * kmMultiplier
        );
      }
    }

    // =====================
    // PAZARLIK (%5)
    // =====================
    const bargainPrice = Math.round(adjustedMarketPrice * 0.95);

    const diffPercent = Number(
      (((listing.price - adjustedMarketPrice) / adjustedMarketPrice) * 100).toFixed(1)
    );

    return res.json({
      success: true,
      analyzedBefore: !!exists,
      marketPrice: adjustedMarketPrice,
      rawMarketPrice: baseMarketPrice,
      bargainPrice,
      diffPercent,
      count: pool.length,
      method: "hibrit (medyan + ortalama + km)"
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.json({
      success: false,
      message: "Sunucu hatası",
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("✅ Server çalışıyor. Port:", PORT);
});
