import { get } from './client';
import { CombinedRevenue } from '@types/domain';

export const homeApi = {
  revenueSummary: (asOfDate: string, period: string) =>
    get<CombinedRevenue>('/home/revenue-summary', { asOfDate, period }),
  quickKpis: (asOfDate: string) =>
    get<HomeQuickKpis>('/home/quick-kpis', { asOfDate }),
};

