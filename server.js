import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const DATA_FILE = "./data.json";

// ----------------- yardımcılar -----------------
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
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ----------------- sağlık -----------------
app.get("/", (_, res) => {
  res.json({ ok: true, message: "Sahibinden Piyasa API çalışıyor" });
});

// ----------------- ANALİZ -----------------
app.post("/api/analyze", (req, res) => {
  const { ilanNo, price, brand, model, year } = req.body;

  if (!ilanNo || !price || !brand || !model || !year) {
    return res.json({ success: false, message: "Eksik veri" });
  }

  const db = loadData();

  // ilan daha önce var mı
  const exists = db.listings.find(l => l.ilanNo === ilanNo);

  if (!exists) {
    db.listings.push({
      ilanNo,
      price,
      brand,
      model,
      year,
      createdAt: Date.now()
    });
    saveData(db);
  }

  // piyasa havuzu
  const pool = db.listings.filter(
    l => l.brand === brand && l.model === model && l.year === year
  );

  const prices = pool.map(p => p.price);

  let marketPrice;
  let method;

  if (prices.length < 8) {
    marketPrice = Math.round(
      prices.reduce((a, b) => a + b, 0) / prices.length
    );
    method = "ortalama";
  } else {
    marketPrice = Math.round(median(prices));
    method = "medyan";
  }

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
    count: prices.length,
    method
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("✅ Server çalışıyor. Port:", PORT)
);
