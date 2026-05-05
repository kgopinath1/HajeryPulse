import { get } from './client';
import {
  BTFilter, WTSummary, MarginAnalysis, SalesQuality,
  OrgNode, TopBrand, TopCustomer,
} from '@types/domain';

export const salesApi = {
  summary: (asOfDate: string, bt: BTFilter) =>
    get<WTSummary>('/sales/wt/summary', { asOfDate, bt }),

  margin: (asOfDate: string, bt: BTFilter) =>
    get<MarginAnalysis>('/sales/wt/margin', { asOfDate, bt }),

  quality: (asOfDate: string, bt: BTFilter) =>
    get<SalesQuality>('/sales/wt/quality', { asOfDate, bt }),

  org: (asOfDate: string, bt: BTFilter, parent: string) =>
    get<OrgNode>('/sales/wt/org', { asOfDate, bt, parent }),

  topBrands: (asOfDate: string, bt: BTFilter, limit = 10) =>
    get<TopBrand[]>('/sales/wt/top-brands', { asOfDate, bt, limit }),

  topCustomers: (asOfDate: string, bt: BTFilter, limit = 10) =>
    get<TopCustomer[]>('/sales/wt/top-customers', { asOfDate, bt, limit }),
};
