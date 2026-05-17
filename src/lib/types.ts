export type AccountCategory =
  | "cash"
  | "investments"
  | "retirement"
  | "property"
  | "other_asset"
  | "liability";

export type Account = {
  id: string;
  name: string;
  category: AccountCategory;
  notes?: string;
  isLiability?: boolean;
  archived?: boolean;
};

export type Snapshot = {
  id: string;
  date: string;
  balances: Record<string, number>;
  monthlyExpenses?: number;
  notes?: string;
};

export type StockMarket = "US" | "SG";

export type Holding = {
  id: string;
  symbol: string;
  name?: string;
  quantity: number;
  market: StockMarket;
  /** Brokerage account to sync live value into */
  linkedAccountId?: string;
};

export type SgHouseType =
  | "HDB_3RM"
  | "HDB_4RM"
  | "HDB_5RM"
  | "HDB_EXEC"
  | "CONDO"
  | "LANDED";

export type PropertyProfile = {
  postalCode: string;
  houseType: SgHouseType;
  floorAreaSqm?: number;
  mortgageOutstanding?: number;
  /** Override estimated value manually */
  manualValue?: number;
};

export type FinanceData = {
  accounts: Account[];
  snapshots: Snapshot[];
  holdings?: Holding[];
  property?: PropertyProfile;
  allocationTargets?: Partial<Record<AccountCategory, number>>;
  settings?: {
    birthYear?: number;
    emergencyFundMonths?: number;
    timezone?: string;
  };
};

export type CategoryTotals = Record<AccountCategory, number>;

export type Insight = {
  id: string;
  severity: "info" | "watch" | "action";
  title: string;
  body: string;
};

export type QuoteResult = {
  symbol: string;
  market: StockMarket;
  price: number;
  currency: "USD" | "SGD";
  priceSgd: number;
  changePercent: number | null;
  name?: string;
};
