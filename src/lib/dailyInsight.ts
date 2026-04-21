import type { SocialMediaContent } from '../types';
import { formatCurrency, formatNumber } from './formatters';

type StrategyLike = { strategy?: { promo?: string; chat?: string; bcan?: string } };

export const generateDailyInsight = (
  revenue: number,
  transactions: number,
  downloaders: number,
  strategies: StrategyLike[],
  socialContent: SocialMediaContent[],
): string => {
  if (
    revenue === 0 &&
    transactions === 0 &&
    downloaders === 0 &&
    strategies.length === 0 &&
    socialContent.length === 0
  ) {
    return 'Tidak ada aktivitas atau data transaksi yang tercatat untuk hari ini.';
  }

  let insight = '';

  if (socialContent.length > 0) {
    const totalReach = socialContent.reduce((acc, curr) => acc + curr.reach, 0);
    if (totalReach > 10000 && revenue > 5000000) {
      insight += `Konten sosial media hari ini sangat efektif dengan reach ${formatNumber(totalReach)}, berkontribusi signifikan terhadap revenue harian yang mencapai ${formatCurrency(revenue)}. `;
    } else if (totalReach > 5000 && downloaders > 100) {
      insight += `Aktivitas konten berhasil mendorong traffic baru dengan ${downloaders} downloader baru hari ini. `;
    } else if (socialContent.some((c) => c.engagement > 500)) {
      insight += `Salah satu konten mendapatkan engagement tinggi, namun konversi ke sales masih perlu dioptimalkan. `;
    } else {
      insight += `Aktivitas konten sosial media membantu menjaga brand awareness hari ini. `;
    }
  }

  if (strategies.length > 0) {
    const hasPromo = strategies.some((s) => s.strategy?.promo);
    const hasPush = strategies.some((s) => s.strategy?.chat || s.strategy?.bcan);
    if (hasPromo && transactions > 50) {
      insight += `Promo yang dijalankan berhasil meningkatkan volume transaksi menjadi ${transactions} order. `;
    }
    if (hasPush && revenue > 0) {
      insight += `Strategi push notification/chat efektif dalam menjaga momentum sales harian. `;
    }
  }

  if (revenue > 10000000) {
    insight += 'Performa hari ini sangat luar biasa (High Revenue Day). ';
  } else if (revenue > 0 && revenue < 1000000) {
    insight +=
      'Revenue harian stabil, namun ada potensi peningkatan melalui optimalisasi jam posting konten. ';
  }

  if (!insight) {
    insight =
      'Aktivitas harian berjalan normal. Fokus pada konsistensi konten untuk meningkatkan awareness.';
  }

  return insight;
};
