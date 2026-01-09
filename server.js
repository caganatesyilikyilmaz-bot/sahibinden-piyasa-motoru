// =====================
// KM NORMALİZASYONU (DOĞRU)
// =====================

// referansKm = aynı havuzdaki ilanların ortalama KM’si
const referansKm =
  pool.reduce((s, l) => s + (l.km || referansKm), 0) / pool.length;

// km farkı
const kmDiff = listing.km - referansKm;

// her 10.000 km için %2 etki
const kmAdjustmentRate = 0.02;

// 🔴 KRİTİK DÜZELTME: EKSİ İŞARETİ
const kmMultiplier = 1 - (kmDiff / 10000) * kmAdjustmentRate;

// güvenlik
const safeMultiplier = Math.max(0.7, Math.min(1.3, kmMultiplier));

// normalize edilmiş piyasa
const adjustedMarketPrice = Math.round(avg * safeMultiplier);
