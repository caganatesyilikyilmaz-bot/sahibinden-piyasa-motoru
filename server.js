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
// ANALYZE (SADECE HESAP)
// =====================
app.post("/api/analyze", (req, res) => {
  try {
    const { ilanNo, brand, model, year, price } = req.body || {};

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

    const pool = db.listings.filter(l =>
      l.brand === brand &&
      l.model === model &&
      l.year === year
    );

    const avg =
      pool.reduce((s, l) => s + l.price, 0) / pool.length;

    const diffPercent =
      ((price - avg) / avg) * 100;

    return res.json({
      success: true,
      analyzedBefore: !!exists,
      marketPrice: Math.round(avg),
      diffPercent: Number(diffPercent.toFixed(1)),
      count: pool.length
    });

  } catch (err) {
    console.error(err);
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
