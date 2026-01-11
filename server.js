import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

const DATA_FILE = "./data.json";

// =====================
// HELPERS
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
app.get("/", (_, res) => {
  res.json({ ok: true, message: "API ayakta" });
});

// =====================
// ANALYZE
// =====================
app.post("/api/analyze", (req, res) => {
  try {
    const {
      ilanNo,
      price,
      brand,
      model,
      year,
      km,
      fuel,
      gear,
      bodyType,
      heavyDamage
    } = req.body || {};

    if (!ilanNo || !price || !brand || !model || !year) {
      return res.json({ success: false, message: "Eksik veri" });
    }

    const listing = {
      ilanNo: String(ilanNo),
      price,
      brand,
      model,
      year,
      km: typeof km === "number" ? km : null,
      fuel: fuel || null,
      gear: gear || null,
      bodyType: bodyType || null,
      heavyDamage: heavyDamage === true,
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
      l.year === listing.year &&
      l.fuel === listing.fuel &&
      l.gear === listing.gear &&
      l.bodyType === listing.bodyType &&
      l.heavyDamage === listing.heavyDamage
    );

    if (pool.length < 3) {
      return res.json({
        success: false,
        message: "Yeterli piyasa verisi yok"
      });
    }

    // =====================
    // HAYALCİ İLANLARI DIŞLA
    // =====================
    const pricesAll = pool.map(l => l.price).sort((a, b) => a - b);

    const median =
      pricesAll.length % 2 === 0
        ? (pricesAll[pricesAll.length / 2 - 1] + pricesAll[pricesAll.length / 2]) / 2
        : pricesAll[Math.floor(pricesAll.length / 2)];

    const filteredPool = pool.filter(
      l => l.price <= median * 1.35
    );

    const prices = filteredPool.map(l => l.price).sort((a, b) => a - b);

    const avg =
      prices.reduce((s, p) => s + p, 0) / prices.length;

    const baseMarketPrice = Math.round((median + avg) / 2);

    // =====================
    // KM NORMALİZASYONU
    // =====================
    let adjustedMarketPrice = baseMarketPrice;

    const kmList = filteredPool
      .map(l => l.km)
      .filter(v => typeof v === "number");

    if (kmList.length && listing.km !== null) {
      const refKm = kmList.reduce((s, v) => s + v, 0) / kmList.length;
      const kmDiff = listing.km - refKm;

      const kmEffect = 0.02; // %2 / 10.000 km
      let kmMultiplier = 1 - (kmDiff / 10000) * kmEffect;
      kmMultiplier = Math.max(0.7, Math.min(1.3, kmMultiplier));

      adjustedMarketPrice = Math.round(baseMarketPrice * kmMultiplier);
    }

    // =====================
    // %4 PAZARLIK
    // =====================
    const bargainPrice = Math.round(adjustedMarketPrice * 0.96);

    // =====================
    // FARK
    // =====================
    const diffPercent = Number(
      (((listing.price - adjustedMarketPrice) / adjustedMarketPrice) * 100).toFixed(1)
    );

    // =====================
    // TAHMİNİ KÂR
    // =====================
    let estimatedProfit = null;
    if (diffPercent < 0) {
      const profit = bargainPrice - listing.price;
      if (profit > 0) estimatedProfit = profit;
    }

    return res.json({
      success: true,
      analyzedBefore: !!exists,
      marketPrice: adjustedMarketPrice,
      bargainAppliedPrice: bargainPrice,
      diffPercent,
      estimatedProfit,
      count: filteredPool.length,
      method: "hibrit + km + %4 pazarlık"
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
