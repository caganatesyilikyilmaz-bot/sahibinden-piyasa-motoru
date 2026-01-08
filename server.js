import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const DATA_FILE = "./data.json";

// ---------------- HELPERS ----------------
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ listings: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------- HEALTH ----------------
app.get("/", (_, res) => {
  res.json({ ok: true, message: "Sahibinden Piyasa API çalışıyor" });
});

// ---------------- ANALYZE ----------------
app.post("/api/analyze", (req, res) => {
  const { ilanNo, price, brand, model, year, km } = req.body;

  if (!ilanNo || !price || !brand || !model || !year || !km) {
    return res.json({ success: false, message: "Eksik veri" });
  }

  const db = loadData();

  const exists = db.listings.find(l => l.ilanNo === ilanNo);

  if (!exists) {
    db.listings.push({
      ilanNo,
      price,
      brand,
      model,
      year,
      km,
      createdAt: Date.now()
    });
    saveData(db);
  }

  // 🔥 AYNI ARAÇ HAVUZU
  const pool = db.listings.filter(
    l => l.brand === brand && l.model === model && l.year === year && l.km
  );

  // 🔥 KM NORMALİZASYONU (%2 / 10.000 km)
  const normalizedPrices = pool.map(l => {
    const kmDiff = km - l.km;               // hedef km - ilan km
    const step = kmDiff / 10000;            // her 10k km
    const factor = step * 0.02;             // %2
    const normalized = l.price * (1 + factor);
    return Math.round(normalized);
  });

  let marketPrice;
  let method;

  if (normalizedPrices.length < 8) {
    marketPrice = Math.round(
      normalizedPrices.reduce((a, b) => a + b, 0) / normalizedPrices.length
    );
    method = "ortalama";
  } else {
    marketPrice = Math.round(median(normalizedPrices));
    method = "medyan";
  }

  // Pazarlık payı (%5)
  const bargainPrice = Math.round(marketPrice * 0.95);

  const diffPercent = Number(
    (((price - marketPrice) / marketPrice) * 100).toFixed(1)
  );

  return res.json({
    success: true,
    analyzedBefore: !!exists,
    marketPrice,
    bargainPrice,
    diffPercent,
    count: normalizedPrices.length,
    method,
    kmRule: "%2 / 10.000 km"
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("✅ Server çalışıyor. Port:", PORT)
);
