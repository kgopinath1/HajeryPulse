import { get } from './client';
import {
  FBBrand, FBOutlet, FBSummary, FbScopeType,
  FBAggregatorRow, FBPaymentRow, FBChannelMix, FBTrend,
} from '@types/domain';

const params = (asOfDate: string, scopeType: FbScopeType, scopeId: string | null,period?:string,limit?: number) => ({
  asOfDate,
  scopeType,
  scopeId,period,limit,
});

export const fbApi = {

  brands: () => get<FBBrand[]>('/fb/brands'),
  // outlets: (brand?: string) => get<FBOutlet[]>('/fb/outlets', brand ? { brand } : undefined),

  outlets: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null,period:string) =>
    get<FBOutlet[]>('/fb/outlets', params(asOfDate, scopeType, scopeId,period)),

  summary: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null , period:string) =>
    get<FBSummary>('/fb/summary', params(asOfDate, scopeType, scopeId,period)),


  brandSummary: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null,period:string) =>
    get<FBBrand[]>('/fb/brand-summary', params(asOfDate, scopeType, scopeId,period)),

  aggregators: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBAggregatorRow[]>('/fb/aggregators', params(asOfDate, scopeType, scopeId)),

  payments: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBPaymentRow[]>('/fb/payments', params(asOfDate, scopeType, scopeId)),

  channels: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBChannelMix>('/fb/channels', params(asOfDate, scopeType, scopeId)),

  deliveryByBrand: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null) =>
    get<FBBrand[]>('/fb/delivery-by-brand', params(asOfDate, scopeType, scopeId)),

  topOutlets: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null, period:string,limit = 10) =>
    get<FBOutlet[]>('/fb/top-outlets', { ...params(asOfDate, scopeType, scopeId,period, limit ), }),

    trend: (asOfDate: string, scopeType: FbScopeType, scopeId: string | null , period:string) =>
        get<FBTrend[]>('/fb/trends', { ...params(asOfDate, scopeType, scopeId,period),  }),


};
