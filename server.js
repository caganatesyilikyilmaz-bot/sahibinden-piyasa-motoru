const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🧠 Hafıza içi veri havuzu (şimdilik)
const marketData = [];

// 📊 Medyan hesaplama
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// 🔌 API ENDPOINT
app.post("/api/market", (req, res) => {
  const {
    brand,
    series,
    model,
    year,
    bodyType,
    price
  } = req.body;

  if (!brand || !model || !year || !bodyType || !price) {
    return res.status(400).json({ error: "Eksik veri" });
  }

  // Veriyi kaydet
  marketData.push({
    brand,
    series,
    model,
    year,
    bodyType,
    price: Number(price)
  });

  // Benzer araçları bul
  const similar = marketData.filter(v =>
    v.brand === brand &&
    v.series === series &&
    v.model === model &&
    v.year === year &&
    v.bodyType === bodyType
  );

  const prices = similar.map(v => v.price);
  const marketPrice = median(prices);

  const diffPercent = marketPrice
    ? ((price - marketPrice) / marketPrice) * 100
    : null;

  res.json({
    marketPrice,
    diffPercent,
    count: prices.length
  });
});

// 🚀 Render port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Piyasa motoru çalışıyor:", PORT);
});
