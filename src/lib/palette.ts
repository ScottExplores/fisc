/** Data colors. Mid-lightness so they hold on paper and on the dark theme. */

export const receiptColor: Record<string, string> = {
  individual: "#c4622d",
  corporate: "#8d4e3b",
  payroll: "#c4923a",
  excise: "#b86b58",
  estate: "#7a5644",
  customs: "#d08a62",
  miscellaneous: "#9a8b78",
  borrowing: "#5d6e78",
  offset: "#6e8a72",
  other: "#8a7d72",
};

export const outlayColor: Record<string, string> = {
  "social security": "#1f7a8c",
  medicare: "#2a9d8f",
  health: "#4caf86",
  "national defense": "#3d5a80",
  "net interest": "#b08968",
  "income security": "#7d8c3a",
  "veterans benefits and services": "#4f6d8a",
  "education, training, employment, and social services": "#7b6b9a",
  transportation: "#3a7ca5",
  "administration of justice": "#8d6a5a",
  "community and regional development": "#c4a35a",
  agriculture: "#6a8f3d",
  "natural resources and environment": "#3d7a6a",
  "international affairs": "#5c6b8a",
  "general science, space, and technology": "#4a5899",
  energy: "#c47b4a",
  "general government": "#8a8175",
  "commerce and housing credit": "#a67c6d",
};

export const outlayShort: Record<string, string> = {
  "social security": "Social Security",
  medicare: "Medicare",
  health: "Health",
  "national defense": "National defense",
  "net interest": "Net interest",
  "income security": "Income security",
  "veterans benefits and services": "Veterans",
  "education, training, employment, and social services": "Education & training",
  transportation: "Transportation",
  "administration of justice": "Justice",
  "community and regional development": "Community development",
  agriculture: "Agriculture",
  "natural resources and environment": "Natural resources",
  "international affairs": "International affairs",
  "general science, space, and technology": "Science & space",
  energy: "Energy",
  "general government": "General government",
  "commerce and housing credit": "Commerce & housing",
  "undistributed offsetting receipts": "Offsetting receipts",
};

const fallback = ["#6b7c8a", "#8a6b7c", "#7c8a6b", "#6b6b8a", "#8a7c6b"];

export function colorForOutlay(label: string, index = 0): string {
  const key = label.toLowerCase().replace(/:$/, "").trim();
  return outlayColor[key] ?? fallback[index % fallback.length];
}

export function shortOutlay(label: string): string {
  const key = label.toLowerCase().replace(/:$/, "").trim();
  return outlayShort[key] ?? cleanName(label);
}

export function cleanName(value: string): string {
  return value.replace(/:+$/, "").replace(/\s+/g, " ").trim();
}

export const hubColor = "#1f6f64";
