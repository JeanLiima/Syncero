export const queryKeys = {
  transactions: {
    all: (companyId: string) => ['transactions', companyId] as const,
    detail: (id: string) => ['transaction', id] as const,
    installmentGroup: (groupId: string) => ['installment-group', groupId] as const,
  },
  categories: {
    all: (companyId: string) => ['categories', companyId] as const,
  },
  contacts: {
    all: (companyId: string, search?: string) => ['contacts', companyId, search] as const,
  },
  banks: {
    all: (companyId: string) => ['banks', companyId] as const,
  },
  dashboard: {
    summary: (companyId: string) => ['dashboard-summary', companyId] as const,
    chart: (companyId: string) => ['dashboard-chart', companyId] as const,
    recent: (companyId: string) => ['dashboard-recent', companyId] as const,
  },
  cashflow: (companyId: string) => ['cashflow', companyId] as const,
  incomeStatement: (companyId: string) => ['incomeStatement', companyId] as const,
} as const
