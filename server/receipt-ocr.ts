import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const execFileAsync = promisify(execFile);

async function runTesseract(imageBuffer: Buffer): Promise<string> {
  const tmpPath = path.join(tmpdir(), `receipt-${randomUUID()}.jpg`);
  await writeFile(tmpPath, imageBuffer);
  try {
    const { stdout } = await execFileAsync("tesseract", [tmpPath, "stdout"], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

// ---------- date parsing ----------

const DATE_REGEXES = [
  /[A-Z][a-z]{2,9}day,?\s+[A-Z][a-z]{2,9}\.?\s+\d{1,2},\s+\d{4}/,
  /[A-Z][a-z]{2,9}\.?\s+\d{1,2},\s+\d{4}/,
  /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/,
  /\d{2}-[A-Z]{3}-\d{2,4}/,
  // All-caps month, no comma -- common on parking/event tickets: "JUN 10 2026"
  /\b[A-Z]{3}\s+\d{1,2}\s+\d{4}\b/,
];

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCMonth() !== month || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeTwoDigitYear(year: number): number {
  return year < 100 ? (year < 70 ? 2000 + year : 1900 + year) : year;
}

function cleanDate(raw: string): string | null {
  const stripped = raw.replace(/^[A-Z][a-z]{2,9}day,\s*/, "").trim();

  let m = stripped.match(/^([A-Z][a-z]{2,9})\.?\s+(\d{1,2}),\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (month !== undefined) return toIsoDate(parseInt(m[3], 10), month, parseInt(m[2], 10));
  }

  m = stripped.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    return toIsoDate(normalizeTwoDigitYear(parseInt(m[3], 10)), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  }

  m = stripped.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return toIsoDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  m = stripped.match(/^(\d{1,2})-([A-Z]{3})-(\d{2,4})$/i);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month !== undefined) return toIsoDate(normalizeTwoDigitYear(parseInt(m[3], 10)), month, parseInt(m[1], 10));
  }

  m = stripped.match(/^([A-Z]{3})\s+(\d{1,2})\s+(\d{4})$/i);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month !== undefined) return toIsoDate(parseInt(m[3], 10), month, parseInt(m[2], 10));
  }

  return null;
}

// Mail/Preview print-to-PDF stamps a "Weekday, Month Day, Year at H:MM:SS AM Timezone"
// banner on every page; it isn't part of the receipt content.
function isPrintBanner(line: string): boolean {
  return /\bat\s+\d{1,2}:\d{2}:\d{2}\s*[AP]M\b/.test(line);
}

const VENDOR_NOISE_LINE_PATTERNS = [
  /^(confirmation|order|ticket|receipt|check|invoice)\s*#/,
  /^thank you\b/,
  // a browser "print to PDF" tab-title banner, e.g.
  // "6/11/26, 8:19 AM    KANALOA SEAFOOD SB | Online Receipt"
  /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*[ap]m\b/,
];

function isVendorNoise(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return isPrintBanner(line) || VENDOR_NOISE_LINE_PATTERNS.some((p) => p.test(lower));
}

function pickVendorLine(lines: string[], maxCandidates = 8): string | null {
  for (const line of lines.slice(0, maxCandidates)) {
    if (line.length > 2 && !/^[\d\W]+$/.test(line) && !isVendorNoise(line)) return line;
  }
  return null;
}

function isEmailHeaderDateLine(line: string): boolean {
  return /^\s*Date:\s*[A-Z][a-z]+day,/.test(line);
}

function findDate(text: string): string | null {
  const lines = text.split("\n").filter((l) => !isEmailHeaderDateLine(l) && !isPrintBanner(l));
  for (const pattern of DATE_REGEXES) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const parsed = cleanDate(match[0]);
        if (parsed) return parsed;
      }
    }
  }
  return null;
}

// ---------- amount parsing ----------

const MONEY = /\$?\s?([\d,]+\.\d{2})/;

function findAmount(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ""));
      if (!Number.isNaN(value)) return value;
    }
  }
  return null;
}

// The bare-"total" tier excludes both "Subtotal" (\b handles it) and "Sub Total"
// written as two words (the negative lookbehind). Kept as the LAST tier because
// payment-line keywords describe the actual card transaction -- when a receipt has
// both, the payment line is the amount that hit the card (e.g. total + tip), while
// a "TOTAL" line may be pre-tip or OCR garbage.
const AMOUNT_KEYWORD_TIERS = [
  /\b(?:amount|total)\s+paid\b/gi,
  /\bcharged?\b/gi,
  /\bgrand\s+total\b/gi,
  /(?:(?<!sub)(?<!sub\s)\btotal\b|\bbalance\s+due\b|\bamount\s+due\b)/gi,
];

/**
 * Finds the receipt's real charge amount even when a keyword and its value get
 * split across lines or have OCR noise between them (scrambled table layouts).
 *
 * Keyword tiers are tried in priority order; the first tier with any hit wins.
 * Within a tier, scans forward from each keyword occurrence, collects every
 * money-shaped value in the window -- skipping suggested-tip lines
 * ("18% of sale: $6.08") -- and returns the largest, since the true amount
 * (subtotal + tax/tip) is virtually always the biggest figure near the keyword.
 */
function findAmountNearTotal(text: string, window = 150): number | null {
  for (const tier of AMOUNT_KEYWORD_TIERS) {
    const candidates: number[] = [];
    for (const m of Array.from(text.matchAll(tier))) {
      const segment = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + window);
      for (const line of segment.split("\n")) {
        if (line.includes("%")) continue;
        const moneyMatch = line.match(MONEY);
        if (moneyMatch) {
          const value = parseFloat(moneyMatch[1].replace(/,/g, ""));
          if (!Number.isNaN(value)) candidates.push(value);
        }
      }
    }
    if (candidates.length > 0) return Math.max(...candidates);
  }
  return null;
}

// ---------- vendor-type detection ----------

const CAR_RENTAL_BRANDS = ["hertz", "avis", "enterprise rent", "national car rental", "budget rent", "alamo"];
const AIRLINES = [
  "united airlines", "american airlines", "delta air", "southwest airlines",
  "jetblue", "alaska airlines", "frontier airlines", "spirit airlines",
];
const HOTEL_MARKERS = [
  "marriott bonvoy", "hilton honors", "guest number", "folio id", "room rate",
  "westin", "hyatt", "sheraton", "ihg", "holiday inn",
];
const RESTAURANT_MARKERS = [
  "powered by toast", "powered by revel", "check #", "guest count:",
  "server:", "eat in order", "table:",
];
const GAS_BRANDS = ["shell", "chevron", "exxon", "mobil", "arco", "costco gas", "76 ", "conoco", "valero"];

type ReceiptType = "car_rental" | "airline" | "rideshare" | "hotel" | "restaurant" | "amazon" | "gas" | "generic";

function detectType(text: string): ReceiptType {
  const lower = text.toLowerCase();
  if (CAR_RENTAL_BRANDS.some((b) => lower.includes(b))) return "car_rental";
  if (AIRLINES.some((a) => lower.includes(a)) || /\bboarding pass\b/.test(lower)) return "airline";
  if (lower.includes("uber") || lower.includes("lyft")) return "rideshare";
  if (HOTEL_MARKERS.some((m) => lower.includes(m))) return "hotel";
  if (RESTAURANT_MARKERS.some((m) => lower.includes(m))) return "restaurant";
  if (lower.includes("amazon.com") && (lower.includes("order") || lower.includes("grand total"))) return "amazon";
  if (GAS_BRANDS.some((g) => lower.includes(g)) || lower.includes("gallons")) return "gas";
  return "generic";
}

interface ParsedReceipt {
  vendorType: ReceiptType;
  vendor: string | null;
  amount: number | null;
  expenseDate: string | null;
}

// ---------- per-type parsers ----------

function parseAirline(text: string): ParsedReceipt {
  const amount = findAmount(text, [
    /Total paid\s*\$?\s?([\d,]+\.\d{2})/i,
    /Total cost\s*\$?\s?([\d,]+\.\d{2})/i,
    /\bTotal\b\s*\$?\s?([\d,]+\.\d{2})/i,
  ]);
  return { vendorType: "airline", vendor: "Airline", amount, expenseDate: findDate(text) };
}

function parseCarRental(text: string): ParsedReceipt {
  const lower = text.toLowerCase();
  const brand = CAR_RENTAL_BRANDS.find((b) => lower.includes(b));
  const vendor = brand ? brand.split(" ")[0].replace(/^./, (c) => c.toUpperCase()) : "Car Rental";
  const amount = findAmount(text, [/TOTAL CHARGES\s*\$?\s?([\d,]+\.\d{2})/i]);
  const dateMatch = text.match(/Rented On:\s*(\d{2}\/\d{2}\/\d{4})/) || text.match(/^Date:\s*(\d{2}\/\d{2}\/\d{4})/m);
  const expenseDate = dateMatch ? cleanDate(dateMatch[1]) : findDate(text);
  return { vendorType: "car_rental", vendor, amount, expenseDate };
}

function parseHotel(text: string): ParsedReceipt {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const vendor = lines[0] || "Hotel";
  const amount = findAmount(text, [
    /\*\s*Sub-Total\s*\$?\s?([\d,]+\.\d{2})/i,
    /\(\$?([\d,]+\.\d{2})\)/,
    /(?:AX|American Express)\D*-\s*\$?([\d,]+\.\d{2})/i,
    /Room Rate:\s*\$?\s?([\d,]+\.\d{2})/i,
  ]);
  const dateMatch = text.match(/Arrive Date\s*:\s*(\d{2}-[A-Z]{3}-\d{2})/i) || text.match(/Arrival Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const expenseDate = dateMatch ? cleanDate(dateMatch[1]) : findDate(text);
  return { vendorType: "hotel", vendor, amount, expenseDate };
}

function parseRestaurant(text: string): ParsedReceipt {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerPrefixes = ["subject:", "date:", "from:", "to:", "attachments:"];
  const bodyLines = lines.filter((l) => !headerPrefixes.some((p) => l.toLowerCase().startsWith(p)));
  const vendor = pickVendorLine(bodyLines) || "Restaurant";
  let amount = findAmount(text, [
    /\b(?:Amount|Total)\s+Paid\b\s*\$?\s?([\d,]+\.\d{2})/i,
    /(?<!Sub)(?<!Sub\s)\bTotal\b\s*\$?\s?([\d,]+\.\d{2})/i,
  ]);
  if (amount === null) amount = findAmountNearTotal(text);
  const dateMatch = text.match(/Ordered:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i) || text.match(/\bDate:\s*(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}\s*[AP]M/);
  const expenseDate = dateMatch ? cleanDate(dateMatch[1]) : findDate(text);
  return { vendorType: "restaurant", vendor, amount, expenseDate };
}

function parseAmazon(text: string): ParsedReceipt {
  const amount = findAmount(text, [/Grand Total:\s*\$?\s?([\d,]+\.\d{2})/i]);
  const dateMatch = text.match(/Order placed\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
  const expenseDate = dateMatch ? cleanDate(dateMatch[1]) : findDate(text);
  return { vendorType: "amazon", vendor: "Amazon.com", amount, expenseDate };
}

function parseGas(text: string): ParsedReceipt {
  const lower = text.toLowerCase();
  const brand = GAS_BRANDS.find((b) => lower.includes(b));
  const vendor = brand ? brand.trim().replace(/^./, (c) => c.toUpperCase()) : "Gas Station";
  const amount = findAmount(text, [/\bTotal\b\s*\$?\s?([\d,]+\.\d{2})/i, MONEY]);
  return { vendorType: "gas", vendor, amount, expenseDate: findDate(text) };
}

function parseRideshare(text: string): ParsedReceipt {
  const vendor = text.toLowerCase().includes("uber") ? "Uber" : "Lyft";
  const amount = findAmount(text, [/\bTotal\b\s*\$?\s?([\d,]+\.\d{2})/i, MONEY]);
  return { vendorType: "rideshare", vendor, amount, expenseDate: findDate(text) };
}

function parseGeneric(text: string): ParsedReceipt {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const vendor = pickVendorLine(lines);
  // findAmountNearTotal collects every candidate near a total-like keyword and
  // takes the max, which also correctly handles the clean single-candidate case --
  // a plain adjacency match here would grab whatever number comes right after
  // "Total" even across blank lines, which is wrong on scrambled OCR tables.
  const amount = findAmountNearTotal(text);
  return { vendorType: "generic", vendor, amount, expenseDate: findDate(text) };
}

const PARSERS: Record<ReceiptType, (text: string) => ParsedReceipt> = {
  car_rental: parseCarRental,
  airline: parseAirline,
  rideshare: parseRideshare,
  hotel: parseHotel,
  restaurant: parseRestaurant,
  amazon: parseAmazon,
  gas: parseGas,
  generic: parseGeneric,
};

// Vendor type -> best-guess category name. The caller intersects this against the
// app's actual active categories (case-insensitively) and drops it if there's no
// match, so it's safe to guess even for categories that don't exist yet.
const CATEGORY_BY_TYPE: Partial<Record<ReceiptType, string>> = {
  airline: "Flights",
  hotel: "Hotel",
  restaurant: "Meals",
  rideshare: "Taxi",
};

export interface ScanResult {
  total: string | null;
  date: string | null;
  business: string | null;
  category: string | null;
}

function decodeImageDataUrl(imageDataUrl: string): Buffer {
  const base64 = imageDataUrl.includes(",") ? imageDataUrl.split(",", 2)[1] : imageDataUrl;
  return Buffer.from(base64, "base64");
}

export async function scanReceiptImage(imageDataUrl: string, activeCategories: string[]): Promise<ScanResult> {
  const buffer = decodeImageDataUrl(imageDataUrl);
  const text = await runTesseract(buffer);
  const vendorType = detectType(text);
  const parser = PARSERS[vendorType] ?? parseGeneric;
  const parsed = parser(text);

  const guessedCategory = CATEGORY_BY_TYPE[parsed.vendorType] ?? null;
  const category = guessedCategory
    ? activeCategories.find((c) => c.toLowerCase() === guessedCategory.toLowerCase()) ?? null
    : null;

  return {
    total: parsed.amount !== null ? parsed.amount.toFixed(2) : null,
    date: parsed.expenseDate,
    business: parsed.vendor,
    category,
  };
}
