import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

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
app.get("/", (req, res) => {
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
      heavyDamage: heavyDamage === "Evet",
      createdAt: Date.now()
    };

    const db = loadData();
    if (!db.listings.find(l => l.ilanNo === listing.ilanNo)) {
      db.listings.push(listing);
      saveData(db);
    }

    // =====================
    // HAVUZ (TAM EŞLEŞME)
    // =====================
    let pool = db.listings.filter(l =>
      l.brand === listing.brand &&
      l.model === listing.model &&
      l.year === listing.year &&
      l.fuel === listing.fuel &&
      l.gear === listing.gear &&
      l.bodyType === listing.bodyType &&
      l.heavyDamage === listing.heavyDamage
    );

    // 🔒 Minimum 5 ilan kuralı
    if (pool.length < 5) {
      return res.json({
        success: false,
        message: "Yeterli piyasa verisi yok",
        count: pool.length
      });
    }

    // =====================
    // %15 HAYALCİ FİYAT FİLTRESİ
    // =====================
    const pricesSorted = pool.map(l => l.price).sort((a, b) => a - b);
    const median = pricesSorted[Math.floor(pricesSorted.length / 2)];
    const maxAllowed = median * 1.15;

    pool = pool.filter(l => l.price <= maxAllowed);

    // =====================
    // HİBRİT PİYASA
    // =====================
    const prices = pool.map(l => l.price);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    let marketPrice = Math.round((median + avg) / 2);

    // =====================
    // KM NORMALİZASYONU
    // =====================
    if (listing.km !== null) {
      const kmList = pool.map(l => l.km).filter(v => typeof v === "number");
      if (kmList.length) {
        const refKm = kmList.reduce((s, v) => s + v, 0) / kmList.length;
        const kmDiff = listing.km - refKm;

        // her 10.000 km = %2 etki
        let kmMultiplier = 1 - (kmDiff / 10000) * 0.02;
        kmMultiplier = Math.max(0.7, Math.min(1.3, kmMultiplier));

        marketPrice = Math.round(marketPrice * kmMultiplier);
      }
    }

    // =====================
    // PAZARLIK (%4 – gizli)
    // =====================
    const bargainPrice = Math.round(marketPrice * 0.96);

    const diffPercent = Number(
      (((listing.price - marketPrice) / marketPrice) * 100).toFixed(1)
    );

    // =====================
    // SADECE ALTINDAYSA KÂR
    // =====================
    let estimatedProfit = null;
    if (diffPercent < 0) {
      const profit = bargainPrice - listing.price;
      if (profit > 0) estimatedProfit = profit;
    }

    return res.json({
      success: true,
      marketPrice,
      diffPercent,
      estimatedProfit,
      count: pool.length,
      method: "hibrit + km + filtre"
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Sunucu hatası" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("✅ Server çalışıyor. Port:", PORT);
});
