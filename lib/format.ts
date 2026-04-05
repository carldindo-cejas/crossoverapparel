export function formatCurrency(cents: number, _currency = "PHP") {
  const amount = (cents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₱${amount}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila"
  }).format(new Date(value));
}
