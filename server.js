const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/*
  Basit hafıza:
  Gerçek üründe DB olacak
*/
const memory = [];

/*
  KATKI ENDPOINT
*/
app.post("/api/v1/contribute", (req, res) => {
  const data = req.body;

  if (!data.brand || !data.model || !data.price) {
    return res.json({ status: "ignored" });
  }

  memory.push({
    brand: data.brand,
    model: data.model,
    fuel: data.fuel,
    gear: data.gear,
    year: data.year,
    km: data.km,
    price: data.price
  });

  res.json({ status: "ok" });
});

/*
  ANALİZ ENDPOINT
*/
app.post("/api/v1/analyze", (req, res) => {
  const q = req.body;

  const similars = memory.filter(m =>
    m.brand === q.brand &&
    m.model === q.model &&
    m.fuel === q.fuel &&
    m.gear === q.gear &&
    Math.abs(m.year - q.year) <= 1
  );

  if (similars.length < 3) {
    return res.json({
      message: "Yeterli veri yok",
      confidence_score: 20
    });
  }

  const prices = similars.map(s => s.price).sort((a,b)=>a-b);
  const median = prices[Math.floor(prices.length / 2)];

  const diffPercent = Math.round(((q.price - median) / median) * 100);

  const profitMin = Math.max(0, median * 0.95 - q.price);
  const profitMax = Math.max(0, median * 0.98 - q.price);

  const flipScore = Math.min(
    100,
    Math.round((median - q.price) / median * 120)
  );

  res.json({
    market_price: median,
    price_diff_percent: diffPercent,
    profit_range: {
      min: Math.round(profitMin),
      max: Math.round(profitMax)
    },
    flip_score: flipScore,
    confidence_score: Math.min(90, similars.length * 10),
    sample_size: similars.length
  });
});

/*
  RENDER PORT
*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server çalışıyor, port:", PORT);
});
