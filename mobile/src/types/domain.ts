/**
 * Domain types shared between API responses and screen components.
 * These mirror the DTOs returned by HajeryPulse.Api.
 */

// Common
export type BTFilter = 'both' | 'wholesale' | 'tender';
export type FbScopeType = 'all' | 'brand' | 'outlet';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Clarification';
export type ApprovalType = 'lpo' | 'asset' | 'expense' | 'hr';

export interface AsOfMeta {
  asOfDate: string;
  asOfTag: string;
  isPartial: boolean;
}

// Sales — Wholesale & Tender
export interface WTSummary {
  asOfDate: string;
  bt: BTFilter;
  revenue: { kwd: number; wow: number };
  kpis: {
    newOrders: number;
    openOrderValueKwd: number;
    activeTenders: number;
    avgTenderValueKwd: number;
  };
  spark: number[];
}

export interface MarginAnalysis {
  marginPct: number;
  marginPctLY: number;
  marginYoyPp: number;
  netSalesKwd: number;
  cogsKwd: number;
  grossMarginKwd: number;
  trend12mo: number[];
  trend12moLY: number[];
}

export interface SalesQuality {
  grossKwd: number;
  returnsKwd: number;
  cancellationsKwd: number;
  netKwd: number;
  netPct: number;
  returnsPct: number;
  cancellationsPct: number;
}

export interface OrgNode {
  level: 'BusinessUnit' | 'Division' | 'BusinessType' | 'Department';
  label: string;
  parentKey: string;
  children: OrgChild[];
}
export interface OrgChild {
  key: string;
  code: string;
  name: string;
  amtW: number;
  amtT: number;
  yoy: number;
  hasChildren: boolean;
}

export interface TopBrand {
  rank: number;
  brand: string;
  segment: string;
  amountKwd: number;
  yoyPct: number;
}

export interface TopCustomer {
  rank: number;
  customer: string;
  type: string;
  ordersThisWeek: number;
  amountKwd: number;
  yoyPct: number;
}

// Pharmacies
export interface Pharmacy {
  id: string;
  name: string;
  amtKwd: number;
}

export interface PharmaSummary {
  pharmacy: Pharmacy;
  revenueKwd: number;
  transactions: number;
  basketSizeKwd: number;
  storesActive: number;
  storesTotal: number;
  rxSharePct: number;
}

export interface PharmaMargin {
  grossKwd: number;
  discountKwd: number;
  cogsKwd: number;
  marginKwd: number;
  netSalesKwd: number;
  marginPct: number;
  marginPctLY: number;
}

export interface PharmaChannel {
  instoreKwd: number;
  callcenterKwd: number;
  aggregatorKwd: number;
}

export interface PharmaPaymentRow { key: string; label: string; kwd: number; pct: number; color: string; }
export interface PharmaCategoryRow { key: string; label: string; kwd: number; pct: number; }
export interface PharmaDiscountRow { id: string; name: string; ratePct: number; discountKwd: number; }
export interface PharmaRxOtcMix {
  rxPct: number;
  otcPct: number;
  rxKwd: number;
  otcKwd: number;
  rxYoyPp: number;
}

// F&B
export interface FBBrand {
  id: string;
  name: string;
  amtKwd: number;
  yoyPct: number;
  color: string;
  deliveryKwd: number;
  outletCount: number;
}

export interface FBOutlet {
  code: string;
  name: string;
  brandId: string;
  amtKwd: number;
  yoyPct: number;
}

export interface FBSummary {
  scope: { type: FbScopeType; id: string | null; name: string };
  revenueKwd: number;
  covers: number;
  ticketKwd: number;
  outletsActive: number;
  outletsTotal: number;
  yoyPct: number;
}

export interface FBAggregatorRow { key: string; label: string; kwd: number; pct: number; color: string; }
export interface FBPaymentRow { key: string; label: string; kwd: number; pct: number; color: string; }

// Inbox
export interface ApprovalRequestSummary {
  id: string;
  type: ApprovalType;
  title: string;
  amountKwd: number;
  requester: string;
  submittedAt: string;
  status: ApprovalStatus;
}

export interface ApprovalRequestDetail extends ApprovalRequestSummary {
  description: string;
  buCode: string;
  lineItems: ApprovalLineItem[];
  attachments: ApprovalAttachment[];
  history: ApprovalHistoryEvent[];
}

export interface ApprovalLineItem {
  itemNo: number;
  description: string;
  qty: number;
  unitPriceKwd: number;
  vendor: string;
}
export interface ApprovalAttachment {
  fileName: string;
  sizeBytes: number;
  url: string;
}
export interface ApprovalHistoryEvent {
  occurredAt: string;
  user: string;
  action: string;
  comment: string | null;
}

// Auth
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  scopedBuCodes: string[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
}
