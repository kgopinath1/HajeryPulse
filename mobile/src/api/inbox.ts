import { get, post } from './client';
import {
  ApprovalRequestSummary, ApprovalRequestDetail, ApprovalStatus,
} from '@types/domain';

export const inboxApi = {
  list: (status: ApprovalStatus | 'all' = 'Pending', limit = 50) =>
    get<{ items: ApprovalRequestSummary[] }>('/inbox', { status, limit }),

  detail: (id: string) => get<ApprovalRequestDetail>(`/inbox/${id}`),

  approve: (id: string, comment: string) =>
    post<{ id: string; status: ApprovalStatus; decidedAt: string }>(
      `/inbox/${id}/approve`, { comment },
    ),

  reject: (id: string, comment: string) =>
    post<{ id: string; status: ApprovalStatus; decidedAt: string }>(
      `/inbox/${id}/reject`, { comment },
    ),

  clarify: (id: string, question: string) =>
    post<{ id: string; status: ApprovalStatus }>(
      `/inbox/${id}/clarify`, { question },
    ),
};
