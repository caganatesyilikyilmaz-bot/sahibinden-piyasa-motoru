import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import cheerio from "cheerio";

const app = express();
app.use(cors());
app.use(express.json());

function cleanNumber(text) {
  if (!text) return null;
  const n = text.replace(/\D/g, "");
  return n ? parseInt(n) : null;
}

app.post("/api/analyze", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.json({ success: false, message: "URL yok" });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
        "Accept-Language": "tr-TR,tr;q=0.9"
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    const specs = {};
    $("li").each((_, el) => {
      const key = $(el).find("strong").text().trim();
      const val = $(el).find("span").text().trim();
      if (key && val) specs[key] = val;
    });

    const priceText = $("div[class*='classified-price'], h2").first().text();
    const price = cleanNumber(priceText);

    const result = {
      success: true,
      price,
      year: specs["Yıl"],
      km: cleanNumber(specs["KM"] || specs["Kilometre"]),
      brand: specs["Marka"],
      model: specs["Model"],
      fuel: specs["Yakıt Tipi"] || specs["Yakıt"],
      gear: specs["Vites"] || specs["Vites Tipi"],
      bodyType: specs["Kasa Tipi"],
      heavyDamage: specs["Ağır Hasar Kayıtlı"] === "Evet"
    };

    return res.json(result);
  } catch (err) {
    return res.json({
      success: false,
      message: "Scraping hatası",
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server çalışıyor:", PORT);
});
