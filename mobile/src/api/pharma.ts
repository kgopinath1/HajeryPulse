import { get } from './client';
import {
  Pharmacy, PharmaSummary, PharmaMargin, SalesQuality,
  PharmaChannel, PharmaPaymentRow, PharmaCategoryRow,
  PharmaDiscountRow, PharmaRxOtcMix, PharmaTrendPoint,
} from '@types/domain';

export const pharmaApi = {
  list: () => get<Pharmacy[]>('/pharma/list'),

  summary: (asOfDate: string, pharmacyId: string, period: 'day' | 'week' | 'month' | 'ytd' = 'week') =>
    get<PharmaSummary>('/pharma/summary', { asOfDate, pharmacyId, period }),

  margin: (asOfDate: string, pharmacyId: string, period: 'day' | 'week' | 'month' | 'ytd' = 'week') =>
    get<PharmaMargin>('/pharma/margin', { asOfDate, pharmacyId, period }),

  quality: (asOfDate: string, pharmacyId: string, period: 'day' | 'week' | 'month' | 'ytd' = 'week') =>
    get<SalesQuality>('/pharma/quality', { asOfDate, pharmacyId, period }),

  channels: (asOfDate: string, pharmacyId: string, period: 'day' | 'week' | 'month' | 'ytd' = 'week') =>
    get<PharmaChannel>('/pharma/channels', { asOfDate, pharmacyId, period }),

  payments: (asOfDate: string, pharmacyId: string, period: 'day' | 'week' | 'month' | 'ytd' = 'week') =>
    get<PharmaPaymentRow[]>('/pharma/payments', { asOfDate, pharmacyId, period }),

  categories: (asOfDate: string, pharmacyId: string, limit = 10) =>
    get<PharmaCategoryRow[]>('/pharma/categories', { asOfDate, pharmacyId, limit }),

  rxOtcMix: (asOfDate: string, pharmacyId: string, period: 'day' | 'week' | 'month' | 'ytd' = 'week') =>
    get<PharmaRxOtcMix>('/pharma/rx-otc-mix', { asOfDate, pharmacyId, period }),

  discountLeaderboard: (asOfDate: string, limit = 10) =>
    get<PharmaDiscountRow[]>('/pharma/discount-leaderboard', { asOfDate, limit }),

  topPharmacies: (asOfDate: string, limit = 10) =>
    get<Pharmacy[]>('/pharma/top', { asOfDate, limit }),

  trend: (asOfDate: string, pharmacyId: string, period: 'day' | 'week' | 'month' | 'ytd' = 'week') =>
    get<PharmaTrendPoint[]>('/pharma/trends', { asOfDate, pharmacyId, period }),
};
