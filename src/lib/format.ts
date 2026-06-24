export function fmtEUR(n: number, digits = 0): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function fmtPct(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)} %`;
}

export function fmtNum(n: number, digits = 0): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

export function ratingColor(rating: string): string {
  switch (rating) {
    case "Excellent":
      return "#16a34a";
    case "Bon":
      return "#65a30d";
    case "Moyen":
      return "#ca8a04";
    case "Fragile":
      return "#ea580c";
    default:
      return "#dc2626";
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
