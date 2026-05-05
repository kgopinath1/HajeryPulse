import { get } from './client';

export interface FinanceHealth {
  grossMarginPct: number;
  targetPct: number;
  previousPct: number;
  arDaysOutstanding: number;
  apDaysOutstanding: number;
  workingCapitalKwd: number;
  cashOnHandKwd: number;
}

export interface OpsSummary {
  fillRatePct: number;
  slaCompliancePct: number;
  avgDispatchHours: number;
  openServiceTickets: number;
}

export const financeApi = {
  health: (asOfDate: string) => get<FinanceHealth>('/finance/health', { asOfDate }),
  ops:    (asOfDate: string) => get<OpsSummary>('/finance/ops', { asOfDate }),
};
