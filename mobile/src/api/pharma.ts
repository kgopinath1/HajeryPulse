import { get } from './client';
import {
  Pharmacy, PharmaSummary, PharmaMargin, SalesQuality,
  PharmaChannel, PharmaPaymentRow, PharmaCategoryRow,
  PharmaDiscountRow, PharmaRxOtcMix,
} from '@types/domain';

export const pharmaApi = {
  list: () => get<Pharmacy[]>('/pharma/list'),

  summary: (asOfDate: string, pharmacyId: string) =>
    get<PharmaSummary>('/pharma/summary', { asOfDate, pharmacyId }),

  margin: (asOfDate: string, pharmacyId: string) =>
    get<PharmaMargin>('/pharma/margin', { asOfDate, pharmacyId }),

  quality: (asOfDate: string, pharmacyId: string) =>
    get<SalesQuality>('/pharma/quality', { asOfDate, pharmacyId }),

  channels: (asOfDate: string, pharmacyId: string) =>
    get<PharmaChannel>('/pharma/channels', { asOfDate, pharmacyId }),

  payments: (asOfDate: string, pharmacyId: string) =>
    get<PharmaPaymentRow[]>('/pharma/payments', { asOfDate, pharmacyId }),

  categories: (asOfDate: string, pharmacyId: string, limit = 10) =>
    get<PharmaCategoryRow[]>('/pharma/categories', { asOfDate, pharmacyId, limit }),

  rxOtcMix: (asOfDate: string, pharmacyId: string) =>
    get<PharmaRxOtcMix>('/pharma/rx-otc-mix', { asOfDate, pharmacyId }),

  discountLeaderboard: (asOfDate: string, limit = 10) =>
    get<PharmaDiscountRow[]>('/pharma/discount-leaderboard', { asOfDate, limit }),

  topPharmacies: (asOfDate: string, limit = 10) =>
    get<Pharmacy[]>('/pharma/top', { asOfDate, limit }),
};
