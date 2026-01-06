import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";

const app = express();

// 🔥 CORS + JSON GARANTİ
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const DATA_FILE = "./data.json";

// =====================
// Helpers
// =====================
function cleanNumber(text) {
  if (!text) return null;
  const n = text.replace(/\D/g, "");
  return n ? Number(n) : null;
}

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
// HEALTH CHECK (ÖNEMLİ)
// =====================
app.get("/", (req, res) => {
  res.json({ ok: true, message: "API ayakta" });
});

// =====================
// ANALYZE
// =====================
app.post("/api/analyze", async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.json({
        success: false,
        message: "URL gelmedi"
      });
    }

    // 🔥 Sahibinden isteği
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
        "Accept-Language": "tr-TR,tr;q=0.9"
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // Teknik bilgiler
    const specs = {};
    $("li").each((_, el) => {
      const key = $(el).find("strong").text().trim();
      const val = $(el).find("span").text().trim();
      if (key && val) specs[key] = val;
    });

    const priceText =
      $("div[class*='classified-price']").first().text() ||
      $("h2").first().text();

    const price = cleanNumber(priceText);
    const ilanNo = cleanNumber(
      html.match(/İlan No\s+(\d+)/)?.[1]
    );

    const brand = specs["Marka"];
    const model = specs["Model"];
    const year = cleanNumber(specs["Yıl"]);

    if (!price || !ilanNo || !brand || !model || !year) {
      return res.json({
        success: false,
        message: "Temel veriler okunamadı"
      });
    }

    const listing = {
      ilanNo: String(ilanNo),
      price,
      brand,
      model,
      year,
      createdAt: Date.now()
    };

    const db = loadData();
    const exists = db.listings.find(l => l.ilanNo === listing.ilanNo);

    if (!exists) {
      db.listings.push(listing);
      saveData(db);
    }

    // Piyasa havuzu
    const pool = db.listings.filter(l =>
      l.brand === listing.brand &&
      l.model === listing.model &&
      l.year === listing.year
    );

    const avg =
      pool.reduce((s, l) => s + l.price, 0) / pool.length;

    const diffPercent =
      ((listing.price - avg) / avg) * 100;

    return res.json({
      success: true,
      analyzedBefore: !!exists,
      marketPrice: Math.round(avg),
      diffPercent: Number(diffPercent.toFixed(1)),
      count: pool.length
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
