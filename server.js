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
// HEALTH
// =====================
app.get("/", (_, res) => {
  res.json({ ok: true });
});

// =====================
// ANALYZE
// =====================
app.post("/api/analyze", (req, res) => {
  try {
    const { ilanNo, price, brand, model, year, km } = req.body;

    if (!ilanNo || !price || !brand || !model || !year) {
      return res.json({ success: false, reason: "missing" });
    }

    const db = loadData();

    const listing = {
      ilanNo: String(ilanNo),
      price: Number(price),
      brand,
      model,
      year: Number(year),
      km: typeof km === "number" ? km : null,
      createdAt: Date.now()
    };

    if (!db.listings.find(l => l.ilanNo === listing.ilanNo)) {
      db.listings.push(listing);
      saveData(db);
    }

    // HAVUZ
    const pool = db.listings.filter(
      l => l.brand === brand && l.model === model && l.year === year
    );

    if (pool.length < 2) {
      return res.json({ success: false, reason: "insufficient" });
    }

    // =====================
    // HİBRİT PİYASA
    // =====================
    const prices = pool.map(l => l.price).sort((a, b) => a - b);
    const median =
      prices.length % 2 === 0
        ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
        : prices[Math.floor(prices.length / 2)];
    const average = prices.reduce((s, p) => s + p, 0) / prices.length;
    const baseMarket = Math.round((median + average) / 2);

    // =====================
    // KM NORMALİZASYONU
    // =====================
    let marketPrice = baseMarket;
    const kmList = pool.map(l => l.km).filter(v => typeof v === "number");

    if (km !== null && kmList.length >= 2) {
      const refKm = kmList.reduce((s, v) => s + v, 0) / kmList.length;
      const kmDiff = km - refKm;
      let multiplier = 1 - (kmDiff / 10000) * 0.02;
      multiplier = Math.max(0.7, Math.min(1.3, multiplier));
      marketPrice = Math.round(baseMarket * multiplier);
    }

    // =====================
    // PAZARLIK
    // =====================
    const bargainPrice = Math.round(marketPrice * 0.95);

    // =====================
    // YÜZDELİK FARK
    // =====================
    const diffPercent = Number(
      (((price - marketPrice) / marketPrice) * 100).toFixed(1)
    );

    // =====================
    // TAHMİNİ KÂR
    // =====================
    let estimatedProfit = null;
    if (diffPercent < 0) {
      const p = bargainPrice - price;
      if (p > 0) estimatedProfit = p;
    }

    // =====================
    // AL–SAT SKORU
    // =====================
    let score = 0;
    if (diffPercent < -10) score += 40;
    else if (diffPercent < -5) score += 30;
    else if (diffPercent < 0) score += 20;

    if (estimatedProfit) score += 20;
    if (km !== null && km < (kmList.reduce((s,v)=>s+v,0)/kmList.length)) score += 15;
    score = Math.min(100, score);

    // =====================
    // GÜVEN SEVİYESİ
    // =====================
    let confidence = "Düşük";
    if (pool.length >= 10) confidence = "Yüksek";
    else if (pool.length >= 5) confidence = "Orta";

    return res.json({
      success: true,
      marketPrice,
      bargainPrice,
      diffPercent,
      estimatedProfit,
      score,
      confidence,
      count: pool.length
    });

  } catch (e) {
    return res.json({ success: false, reason: "error" });
  }
});

app.listen(10000, () => console.log("✅ Server hazır"));
