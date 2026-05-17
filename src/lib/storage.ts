import { promises as fs } from "fs";
import path from "path";
import { head, put } from "@vercel/blob";
import { normalizeFinanceData } from "./normalize";
import type { FinanceData } from "./types";

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
    const meta = await head(BLOB_PATHNAME);
    const res = await fetch(meta.url);
    if (!res.ok) return null;
    return (await res.json()) as FinanceData;
  } catch {
    return null;
  }
}

async function writeToBlob(data: FinanceData): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromDisk(): Promise<FinanceData> {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return normalizeFinanceData(JSON.parse(raw) as FinanceData);
}

export async function readFinanceData(): Promise<FinanceData> {
  if (isBlobStorageEnabled()) {
    const blobData = await readFromBlob();
    if (blobData) return normalizeFinanceData(blobData);
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
