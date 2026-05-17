import type { PropertyProfile, SgHouseType } from "./types";
import { townFromPostal } from "./sg-postal";

const HDB_RESOURCE =
  "36bcb38b-9569-4933-87a4-4df5cdb96ecf";

const FLAT_TYPE_MAP: Record<SgHouseType, string | null> = {
  HDB_3RM: "3 ROOM",
  HDB_4RM: "4 ROOM",
  HDB_5RM: "5 ROOM",
  HDB_EXEC: "EXECUTIVE",
  CONDO: null,
  LANDED: null,
};

/** Fallback median resale (SGD) by town — updated from HDB Q3 2024 public summaries. */
const TOWN_MEDIANS_4RM: Record<string, number> = {
  "Ang Mo Kio": 520_000,
  Bedok: 540_000,
  Bishan: 620_000,
  "Bukit Batok": 480_000,
  "Bukit Merah": 580_000,
  "Bukit Timah": 720_000,
  "Choa Chu Kang": 490_000,
  Clementi: 560_000,
  Geylang: 500_000,
  Hougang: 510_000,
  "Jurong East": 470_000,
  Kallang: 560_000,
  "Marine Parade": 650_000,
  Pasir: 500_000,
  Punggol: 530_000,
  Queenstown: 680_000,
  Sembawang: 470_000,
  Sengkang: 520_000,
  Serangoon: 550_000,
  Tampines: 530_000,
  "Toa Payoh": 580_000,
  Woodlands: 480_000,
  Yishun: 490_000,
  Singapore: 520_000,
};

const TYPE_MULTIPLIER: Record<SgHouseType, number> = {
  HDB_3RM: 0.72,
  HDB_4RM: 1,
  HDB_5RM: 1.28,
  HDB_EXEC: 1.45,
  CONDO: 2.2,
  LANDED: 3.5,
};

const AVG_SQM: Record<SgHouseType, number> = {
  HDB_3RM: 68,
  HDB_4RM: 93,
  HDB_5RM: 115,
  HDB_EXEC: 130,
  CONDO: 85,
  LANDED: 200,
};

export type PropertyEstimate = {
  estimatedValue: number;
  equity: number;
  town: string;
  flatType: string;
  source: "hdb_data" | "heuristic";
  sampleCount?: number;
  mortgageOutstanding: number;
  disclaimer: string;
};

function toHdbTownName(town: string): string {
  return town.toUpperCase();
}

async function fetchHdbMedian(
  town: string,
  flatType: string,
): Promise<{ median: number; count: number } | null> {
  try {
    const hdbTown = toHdbTownName(town);
    const url = new URL("https://data.gov.sg/api/action/datastore_search");
    url.searchParams.set("resource_id", HDB_RESOURCE);
    url.searchParams.set("limit", "500");
    url.searchParams.set(
      "filters",
      JSON.stringify({ town: hdbTown, flat_type: flatType }),
    );

    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      result?: {
        records?: {
          resale_price: string;
          floor_area_sqm: string;
          month: string;
        }[];
      };
    };

    const records = json.result?.records ?? [];
    if (records.length === 0) return null;

    const sorted = [...records].sort((a, b) => b.month.localeCompare(a.month));
    const recent = sorted.slice(0, Math.min(80, sorted.length));
    const prices = recent
      .map((r) => Number(r.resale_price))
      .filter((p) => !Number.isNaN(p) && p > 0);

    if (prices.length === 0) return null;

    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 0
        ? (prices[mid - 1] + prices[mid]) / 2
        : prices[mid];

    return { median, count: prices.length };
  } catch {
    return null;
  }
}

function heuristicEstimate(
  town: string,
  houseType: SgHouseType,
  floorAreaSqm?: number,
): number {
  const base4rm = TOWN_MEDIANS_4RM[town] ?? TOWN_MEDIANS_4RM.Singapore;
  let value = base4rm * TYPE_MULTIPLIER[houseType];
  const avgSqm = AVG_SQM[houseType];
  if (floorAreaSqm && floorAreaSqm > 0 && avgSqm > 0) {
    value *= Math.min(1.35, Math.max(0.75, floorAreaSqm / avgSqm));
  }
  return Math.round(value);
}

export async function estimateProperty(
  profile: PropertyProfile,
): Promise<PropertyEstimate> {
  const mortgage = profile.mortgageOutstanding ?? 0;
  if (profile.manualValue !== undefined && profile.manualValue > 0) {
    return {
      estimatedValue: profile.manualValue,
      equity: profile.manualValue - mortgage,
      town: townFromPostal(profile.postalCode),
      flatType: profile.houseType,
      source: "heuristic",
      mortgageOutstanding: mortgage,
      disclaimer:
        "Manual valuation. HDB/data.gov.sg estimates are indicative only.",
    };
  }

  const town = townFromPostal(profile.postalCode);
  const flatTypeLabel = FLAT_TYPE_MAP[profile.houseType];
  let estimatedValue: number;
  let source: PropertyEstimate["source"] = "heuristic";
  let sampleCount: number | undefined;

  if (flatTypeLabel) {
    const hdb = await fetchHdbMedian(town, flatTypeLabel);
    if (hdb) {
      estimatedValue = hdb.median;
      source = "hdb_data";
      sampleCount = hdb.count;
      const avgSqm = AVG_SQM[profile.houseType];
      if (profile.floorAreaSqm && avgSqm > 0) {
        estimatedValue *= Math.min(
          1.3,
          Math.max(0.8, profile.floorAreaSqm / avgSqm),
        );
      }
      estimatedValue = Math.round(estimatedValue);
    } else {
      estimatedValue = heuristicEstimate(
        town,
        profile.houseType,
        profile.floorAreaSqm,
      );
    }
  } else {
    estimatedValue = heuristicEstimate(
      town,
      profile.houseType,
      profile.floorAreaSqm,
    );
  }

  return {
    estimatedValue,
    equity: estimatedValue - mortgage,
    town,
    flatType: profile.houseType,
    source,
    sampleCount,
    mortgageOutstanding: mortgage,
    disclaimer:
      "Indicative estimate from recent HDB resale transactions (data.gov.sg) or regional heuristics. Not a formal valuation.",
  };
}
