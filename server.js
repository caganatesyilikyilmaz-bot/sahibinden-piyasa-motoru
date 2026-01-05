const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/analyze", (req, res) => {
  const { url, ilanNo } = req.body;

  // ŞİMDİLİK SAHTE (TEST) VERİ
  // Ama endpoint GERÇEK
  return res.json({
    success: true,
    price: 450000,
    year: 2018,
    km: 125000,
    brand: "Toyota",
    model: "Corolla",
    fuel: "Benzin",
    gear: "Manuel",
    bodyType: "Sedan",
    marketText: "Piyasa seviyesinde (test veri)",
    ilanNo,
    url
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server çalışıyor:", PORT);
});
