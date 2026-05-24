import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";
import { normalizeFinanceData } from "./normalize";
import type { Account, FinanceData } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "finance.json");
const BLOB_PATHNAME = "finance.json";

const defaultData: FinanceData = {
  accounts: [],
  snapshots: [],
  settings: { emergencyFundMonths: 6, timezone: "Asia/Singapore" },
};

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readFromBlob(): Promise<FinanceData | null> {
  try {
    const result = await get(BLOB_PATHNAME, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return normalizeFinanceData(JSON.parse(text) as FinanceData);
  } catch {
    return null;
  }
}

async function writeToBlob(data: FinanceData): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromDisk(): Promise<FinanceData> {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return normalizeFinanceData(JSON.parse(raw) as FinanceData);
}

function accountIdsAdded(before: Account[], after: Account[]): boolean {
  const beforeIds = new Set(before.map((a) => a.id));
  return after.some((a) => !beforeIds.has(a.id));
}

export async function readFinanceData(): Promise<FinanceData> {
  if (isBlobStorageEnabled()) {
    const blobData = await readFromBlob();
    if (blobData) {
      const normalized = normalizeFinanceData(blobData);
      if (accountIdsAdded(blobData.accounts ?? [], normalized.accounts)) {
        await writeToBlob(normalized);
      }
      return normalized;
    }
  }

  try {
    return await readFromDisk();
  } catch {
    return defaultData;
  }
}

export async function writeFinanceData(data: FinanceData): Promise<void> {
  const normalized = normalizeFinanceData(data);
  if (isBlobStorageEnabled()) {
    await writeToBlob(normalized);
    return;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Saving is not configured for Vercel. Add a Blob store (Storage → Blob) and redeploy.",
    );
  }

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(
    DATA_PATH,
    JSON.stringify(normalized, null, 2),
    "utf-8",
  );
}
