import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const listings = [];

app.get("/", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/analyze", (req, res) => {
  const {
    ilanNo,
    price,
    brand,
    model,
    year
  } = req.body || {};

  if (!ilanNo || !price || !brand || !model || !year) {
    return res.json({
      success: false,
      message: "Eksik veri"
    });
  }

  const exists = listings.find(l => l.ilanNo === ilanNo);

  if (!exists) {
    listings.push({ ilanNo, price, brand, model, year });
  }

  const pool = listings.filter(
    l => l.brand === brand && l.model === model && l.year === year
  );

  const avg =
    pool.reduce((s, l) => s + l.price, 0) / pool.length;

  const diffPercent = ((price - avg) / avg) * 100;

  res.json({
    success: true,
    analyzedBefore: !!exists,
    marketPrice: Math.round(avg),
    diffPercent: Number(diffPercent.toFixed(1)),
    count: pool.length
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("✅ Server çalışıyor:", PORT);
});
