/** First two digits of SG postal code → planning area / town (approximate). */
const SECTOR_TOWN: Record<string, string> = {
  "01": "Downtown Core",
  "02": "Tanjong Pagar",
  "03": "Central",
  "04": "Harbourfront",
  "05": "Outram",
  "06": "Downtown Core",
  "07": "Rochor",
  "08": "Rochor",
  "09": "Orchard",
  "10": "Bukit Timah",
  "11": "Bukit Merah",
  "12": "Bukit Merah",
  "13": "Bukit Merah",
  "14": "Kallang",
  "15": "Marine Parade",
  "16": "Bedok",
  "17": "Changi",
  "18": "Tampines",
  "19": "Hougang",
  "20": "Hougang",
  "21": "Hougang",
  "22": "Punggol",
  "23": "Bukit Timah",
  "24": "Bukit Timah",
  "25": "Woodlands",
  "26": "Yishun",
  "27": "Yishun",
  "28": "Yishun",
  "29": "Yishun",
  "30": "Ang Mo Kio",
  "31": "Ang Mo Kio",
  "32": "Ang Mo Kio",
  "33": "Serangoon",
  "34": "Serangoon",
  "35": "Serangoon",
  "36": "Serangoon",
  "37": "Serangoon",
  "38": "Hougang",
  "39": "Hougang",
  "40": "Serangoon",
  "41": "Serangoon",
  "42": "Serangoon",
  "43": "Punggol",
  "44": "Punggol",
  "45": "Punggol",
  "46": "Punggol",
  "47": "Punggol",
  "48": "Tampines",
  "49": "Tampines",
  "50": "Bedok",
  "51": "Bedok",
  "52": "Bedok",
  "53": "Bedok",
  "54": "Bedok",
  "55": "Geylang",
  "56": "Toa Payoh",
  "57": "Toa Payoh",
  "58": "Bishan",
  "59": "Bishan",
  "60": "Bukit Batok",
  "61": "Bukit Batok",
  "62": "Bukit Batok",
  "63": "Bukit Batok",
  "64": "Jurong East",
  "65": "Bukit Batok",
  "66": "Bukit Batok",
  "67": "Choa Chu Kang",
  "68": "Choa Chu Kang",
  "69": "Jurong West",
  "70": "Choa Chu Kang",
  "71": "Choa Chu Kang",
  "72": "Choa Chu Kang",
  "73": "Choa Chu Kang",
  "74": "Choa Chu Kang",
  "75": "Yishun",
  "76": "Yishun",
  "77": "Yishun",
  "78": "Yishun",
  "79": "Central",
  "80": "Central",
  "81": "Bukit Merah",
  "82": "Bukit Merah",
  "83": "Central",
  "84": "Central",
  "85": "Central",
  "86": "Central",
  "87": "Central",
  "88": "Central",
  "89": "Central",
  "90": "Central",
  "91": "Central",
  "92": "Central",
  "93": "Central",
  "94": "Central",
  "95": "Central",
  "96": "Central",
  "97": "Central",
  "98": "Central",
  "99": "Central",
};

/** Maps planning-area label → HDB resale dataset town name (data.gov.sg). */
const HDB_TOWN: Record<string, string> = {
  "Ang Mo Kio": "ANG MO KIO",
  Bedok: "BEDOK",
  Bishan: "BISHAN",
  "Bukit Batok": "BUKIT BATOK",
  "Bukit Merah": "BUKIT MERAH",
  "Bukit Timah": "BUKIT TIMAH",
  "Choa Chu Kang": "CHOA CHU KANG",
  Clementi: "CLEMENTI",
  Geylang: "GEYLANG",
  Hougang: "HOUGANG",
  "Jurong East": "JURONG EAST",
  "Jurong West": "JURONG WEST",
  Kallang: "KALLANG/WHAMPOA",
  "Marine Parade": "MARINE PARADE",
  Punggol: "PUNGGOL",
  Queenstown: "QUEENSTOWN",
  Sembawang: "SEMBAWANG",
  Sengkang: "SENGKANG",
  Serangoon: "SERANGOON",
  Tampines: "TAMPINES",
  "Toa Payoh": "TOA PAYOH",
  Woodlands: "WOODLANDS",
  Yishun: "YISHUN",
  Singapore: "SENGKANG",
  "Downtown Core": "CENTRAL AREA",
  "Tanjong Pagar": "CENTRAL AREA",
  Central: "CENTRAL AREA",
  Harbourfront: "BUKIT MERAH",
  Outram: "CENTRAL AREA",
  Orchard: "CENTRAL AREA",
  Rochor: "KALLANG/WHAMPOA",
  Changi: "PASIR RIS",
  "Lim Chu Kang": "CHOA CHU KANG",
  Tuas: "JURONG WEST",
};

export type NormalizedPostal =
  | { ok: true; code: string; sector: string; town: string; hdbTown: string }
  | { ok: false; error: string };

export function postalSector(postalCode: string): string | null {
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length < 2) return null;
  return digits.slice(0, 2);
}

export function townFromPostal(postalCode: string): string {
  const sector = postalSector(postalCode);
  if (!sector) return "Singapore";
  return SECTOR_TOWN[sector] ?? "Singapore";
}

export function hdbTownFromPostal(postalCode: string): string {
  const town = townFromPostal(postalCode);
  return HDB_TOWN[town] ?? town.toUpperCase();
}

/** Strip to 6-digit SG postal code; validate sector exists in our map. */
export function normalizeSgPostalCode(input: string): NormalizedPostal {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) {
    return { ok: false, error: "Enter your 6-digit postal code." };
  }
  if (digits.length < 6) {
    return {
      ok: false,
      error: `Postal code needs 6 digits (you entered ${digits.length}).`,
    };
  }
  const code = digits.slice(0, 6);
  const sector = code.slice(0, 2);
  if (!SECTOR_TOWN[sector]) {
    return {
      ok: false,
      error: `Sector ${sector} is not a recognised Singapore postal sector.`,
    };
  }
  const town = SECTOR_TOWN[sector];
  return {
    ok: true,
    code,
    sector,
    town,
    hdbTown: HDB_TOWN[town] ?? town.toUpperCase(),
  };
}
