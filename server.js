import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

const DATA_FILE = "./data.json";

// =====================
// Helpers
// =====================
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
// ANALYZE – AL–SAT SKORU (A MODELİ)
// =====================
app.post("/api/analyze", (req, res) => {
  try {
    const {
      ilanNo,
      brand,
      model,
      year,
      price,
      isNewListing, // 0–3 gün
      priceTrend,   // "down" | "up" | "same"
      hasHeavyDamage,
      highKm
    } = req.body || {};

    if (!ilanNo || !brand || !model || !year || !price) {
      return res.json({
        success: false,
        message: "Gerekli veriler eksik"
      });
    }

    const db = loadData();
    const exists = db.listings.find(l => l.ilanNo === ilanNo);

    if (!exists) {
      db.listings.push({
        ilanNo,
        brand,
        model,
        year,
        price,
        createdAt: Date.now()
      });
      saveData(db);
    }

    // ===== Piyasa Havuzu =====
    const pool = db.listings.filter(l =>
      l.brand === brand &&
      l.model === model &&
      l.year === year
    );

    const marketPrice =
      pool.reduce((s, l) => s + l.price, 0) / pool.length;

    const diffPercent =
      ((price - marketPrice) / marketPrice) * 100;

    // =====================
    // AL–SAT SKORU (A MODEL)
    // =====================
    let score = 0;

    // 1️⃣ Fiyat avantajı (0–30)
    const absDiff = Math.abs(diffPercent);
    if (diffPercent < 0) {
      if (absDiff >= 8) score += 30;
      else if (absDiff >= 5) score += 20;
      else if (absDiff >= 3) score += 10;
    }

    // 2️⃣ Fiyat trendi (-10 → +10)
    if (priceTrend === "down") score += 10;
    if (priceTrend === "up") score -= 10;

    // 3️⃣ Yeni ilan (0–10)
    if (isNewListing === true) score += 10;

    // 4️⃣ Likidite (0–20)
    if (pool.length >= 20) score += 20;
    else if (pool.length >= 10) score += 10;

    // 5️⃣ Risk (-20 → 0)
    if (hasHeavyDamage) score -= 20;
    else if (highKm) score -= 10;

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    let label = "🔴 Al–Sat Uygun Değil";
    if (score >= 80) label = "🟢 Çok İyi Fırsat";
    else if (score >= 60) label = "🟡 Al–Sat Uygun";
    else if (score >= 40) label = "⚠️ Riskli";

    return res.json({
      success: true,
      analyzedBefore: !!exists,
      marketPrice: Math.round(marketPrice),
      diffPercent: Number(diffPercent.toFixed(1)),
      count: pool.length,
      alSatScore: score,
      alSatLabel: label
    });

  } catch (err) {
    return res.json({
      success: false,
      message: "Sunucu hatası"
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("✅ Server çalışıyor. Port:", PORT);
});
