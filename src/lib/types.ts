export type AccountCategory =
  | "cash"
  | "investments"
  | "retirement"
  | "property"
  | "other_asset"
  | "liability";

export type InsurancePolicyType =
  | "whole_life"
  | "ilp"
  | "endowment"
  | "term"
  | "hospitalisation"
  | "other";

export type InsurancePolicy = {
  id: string;
  insurer: string;
  planName: string;
  policyType: InsurancePolicyType;
  /** Current surrender or cash value (SGD) */
  surrenderValue: number;
  sumAssured?: number;
  annualPremium?: number;
  maturityDate?: string;
  notes?: string;
  archived?: boolean;
};

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

export type StockMarket = "US" | "SG" | "HK";

export type Holding = {
  id: string;
  symbol: string;
  name?: string;
  quantity: number;
  market: StockMarket;
  /** Average buy price in native currency (USD for US, SGD for SG) */
  avgEntryPrice: number;
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

export type TradeCategory = "stocks" | "govt" | "robo" | "other";

export type Trade = {
  id: string;
  entryDate: string;
  exitDate?: string;
  market: StockMarket;
  category: TradeCategory;
  symbol: string;
  description?: string;
  quantity: number;
  /** Per-unit price in listing currency (USD or SGD) */
  entryPrice: number;
  /** Exit or mark-to-market price per unit when closed / for non-equity */
  exitPrice?: number;
  /** @deprecated Use entryCommission */
  fees?: number;
  /** Broker commission on buy (native currency) */
  entryCommission?: number;
  /** Broker commission on sell (native currency) */
  exitCommission?: number;
  /** Total net cash received (US: after 30% WHT). */
  dividendIncome?: number;
  /** Total gross before WHT (US only). */
  dividendGross?: number;
  /** Last date dividends were fetched from Yahoo */
  dividendsAutoUpdated?: string;
  linkedAccountId?: string;
  ideaSource?: string;
  notes?: string;
};

export type FinanceData = {
  accounts: Account[];
  snapshots: Snapshot[];
  holdings?: Holding[];
  trades?: Trade[];
  insurancePolicies?: InsurancePolicy[];
  property?: PropertyProfile;
  allocationTargets?: Partial<Record<AccountCategory, number>>;
  settings?: {
    birthYear?: number;
    emergencyFundMonths?: number;
    timezone?: string;
    /** Gross monthly income in SGD (used for savings & projections) */
    monthlyIncome?: number;
    /** Optional annual bonus in SGD, spread evenly across 12 months in projections */
    annualBonus?: number;
    /** Expected annual investment return % for projections (default 5) */
    projectionReturnPct?: number;
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
  currency: "USD" | "SGD" | "HKD";
  priceSgd: number;
  changePercent: number | null;
  name?: string;
};
