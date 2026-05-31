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

export type PersonalLoan = {
  id: string;
  borrowerName: string;
  /** Outstanding principal owed to you (SGD) */
  principalOutstanding: number;
  interestRatePct?: number;
  loanDate?: string;
  expectedRepaymentDate?: string;
  notes?: string;
  archived?: boolean;
};

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
  /** Last estimated market value from Property tab (SGD) */
  estimatedValue?: number;
};

export type VehicleProfile = {
  /** e.g. Toyota Camry 2.5 */
  makeModel: string;
  modelYear?: number;
  /** Current market / resale value in SGD */
  estimatedValue: number;
  plateNumber?: string;
  notes?: string;
  /** ISO date when value was last updated */
  valueAsOf?: string;
};

export type TradeCategory = "stocks" | "govt" | "robo" | "other";

export type DividendPayment = {
  id: string;
  /** Cash received (from broker statement) */
  paymentDate: string;
  /** Ex-dividend date if known (Yahoo uses this) */
  exDate?: string;
  grossPerShare: number;
  grossTotal: number;
  netTotal: number;
  source: "manual" | "yahoo";
};

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
  /** Total net cash received (US: after 30% WHT). Sum of dividendPayments. */
  dividendIncome?: number;
  /** Total gross before WHT (US only). Sum of dividendPayments. */
  dividendGross?: number;
  /** Cash dividends — enter from broker; do not rely on Yahoo alone. */
  dividendPayments?: DividendPayment[];
  /** @deprecated */
  dividendsAutoUpdated?: string;
  linkedAccountId?: string;
  ideaSource?: string;
  notes?: string;
};

export type InvestmentPhilosophy = {
  /** Rules, mindset, and process for trading */
  trading?: string;
  /** Long-term investing principles and allocation beliefs */
  investing?: string;
  /** ISO date when last saved */
  updatedAt?: string;
};

export type MostLiquidPlan = {
  /** Max % of most liquid net worth in stocks + funds (default 70) */
  maxStocksFundsPct?: number;
  /** Target % of the stocks/funds slice in SG stocks (default 50) */
  sgShareOfStocksFundsPct?: number;
};

export type FinanceData = {
  accounts: Account[];
  snapshots: Snapshot[];
  holdings?: Holding[];
  trades?: Trade[];
  insurancePolicies?: InsurancePolicy[];
  personalLoans?: PersonalLoan[];
  property?: PropertyProfile;
  vehicle?: VehicleProfile;
  philosophy?: InvestmentPhilosophy;
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
    /** Most-liquid allocation plan (dashboard chart) */
    mostLiquidPlan?: MostLiquidPlan;
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
