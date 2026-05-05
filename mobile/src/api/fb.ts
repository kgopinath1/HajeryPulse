import { get } from './client';
import {
  FBBrand, FBOutlet, FBSummary, FbScopeType,
  FBAggregatorRow, FBPaymentRow,
} from '@types/domain';

const params = (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) => ({
  asOfDate,
  scopeType,
  scopeId,
});

export const fbApi = {
  brands: () => get<FBBrand[]>('/fb/brands'),
  outlets: (brand?: string) => get<FBOutlet[]>('/fb/outlets', brand ? { brand } : undefined),

  summary: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBSummary>('/fb/summary', params(asOfDate, scopeType, scopeId)),

  brandSummary: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBBrand[]>('/fb/brand-summary', params(asOfDate, scopeType, scopeId)),

  aggregators: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBAggregatorRow[]>('/fb/aggregators', params(asOfDate, scopeType, scopeId)),

  payments: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBPaymentRow[]>('/fb/payments', params(asOfDate, scopeType, scopeId)),

  deliveryByBrand: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBBrand[]>('/fb/delivery-by-brand', params(asOfDate, scopeType, scopeId)),

  topOutlets: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null, limit = 10) =>
    get<FBOutlet[]>('/fb/top-outlets', { ...params(asOfDate, scopeType, scopeId), limit }),
};
