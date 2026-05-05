/** React Navigation route types — single source of truth for navigation params. */

export type RootStackParamList = {
  Login: undefined;
  AppTabs: undefined;
  ApprovalDetail: { requestId: string };
};

export type AppTabsParamList = {
  WholesaleTender: undefined;
  Pharmacies: undefined;
  FB: undefined;
  FinanceOps: undefined;
  Inbox: undefined;
};
