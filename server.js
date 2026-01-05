import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Metinden sadece sayıyı alır
 */
function cleanNumber(text) {
  if (!text) return null;
  const n = text.replace(/\D/g, "");
  return n ? Number(n) : null;
}

/**
 * Sahibinden ilan analiz endpoint'i
 */
app.post("/api/analyze", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes("sahibinden.com")) {
    return res.json({
      success: false,
      message: "Geçerli ilan URL'si yok"
    });
  }

  try {
    // 1️⃣ Sayfayı çek
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      },
      timeout: 15000
    });

    if (!response.ok) {
      return res.json({
        success: false,
        message: "Sahibinden sayfası alınamadı",
        status: response.status
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 2️⃣ Teknik özellikleri oku
    const specs = {};
    $("li").each((_, el) => {
      const key = $(el).find("strong").first().text().trim();
      const val = $(el).find("span").first().text().trim();
      if (key && val) {
        specs[key] = val;
      }
    });

    // 3️⃣ Fiyatı oku
    const priceText =
      $("div[class*='classified-price']").first().text() ||
      $("h2").first().text();

    const price = cleanNumber(priceText);

    if (!price) {
      return res.json({
        success: false,
        message: "Fiyat okunamadı (Cloudflare olabilir)"
      });
    }

    // 4️⃣ Sonuç
    const result = {
      success: true,
      price,
      year: specs["Yıl"] || null,
      km: cleanNumber(specs["KM"] || specs["Kilometre"]),
      brand: specs["Marka"] || null,
      model: specs["Model"] || null,
      fuel: specs["Yakıt Tipi"] || specs["Yakıt"] || null,
      gear: specs["Vites"] || specs["Vites Tipi"] || null,
      bodyType: specs["Kasa Tipi"] || null,
      heavyDamage: specs["Ağır Hasar Kayıtlı"] === "Evet",
      source: "sahibinden"
    };

    return res.json(result);
  } catch (err) {
    return res.json({
      success: false,
      message: "Sunucu scraping hatası",
      error: err.message
    });
  }
});

// Sunucu başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Server çalışıyor. Port:", PORT);
});
