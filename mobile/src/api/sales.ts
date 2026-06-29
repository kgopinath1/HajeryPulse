import { get } from './client';
import {
  BTFilter, WTSummary, MarginAnalysis, SalesQuality,
  OrgNode, TopBrand, TopCustomer,
} from '@types/domain';

export const salesApi = {
  summary: (asOfDate: string, bt: BTFilter, period: 'day' | 'week' | 'month' | 'ytd') =>
    get<WTSummary>('/sales/wt/summary', { asOfDate, bt ,period}),

  margin: (asOfDate: string, bt: BTFilter ) =>
    get<MarginAnalysis>('/sales/wt/margin', { asOfDate, bt }),

  quality: (asOfDate: string, bt: BTFilter, period: 'day' | 'week' | 'month' | 'ytd') =>
    get<SalesQuality>('/sales/wt/quality', { asOfDate, bt, period }),

  org: (asOfDate: string, bt: BTFilter, parent: string, period: 'day' | 'week' | 'month' | 'ytd') =>
    get<OrgNode>('/sales/wt/org', { asOfDate, bt, parent, period }),

  topBrands: (asOfDate: string, bt: BTFilter, period: 'day' | 'week' | 'month' | 'ytd', limit = 10) =>
    get<TopBrand[]>('/sales/wt/top-brands', { asOfDate, bt, period, limit }),

  topCustomers: (asOfDate: string, bt: BTFilter, period: 'day' | 'week' | 'month' | 'ytd', limit = 10) =>
    get<TopCustomer[]>('/sales/wt/top-customers', { asOfDate, bt, period, limit }),
};
