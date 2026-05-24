export type Permissions = {
  viewFinancials: boolean
  tabs: {
    dashboard:      boolean
    projects:       boolean
    suppliers:      boolean
    bills:          boolean
    clients:        boolean
    reports:        boolean
    admin:          boolean
    uploadBill:     boolean
    communications: boolean
    settings:       boolean
  }
}

export const ADMIN_PERMISSIONS: Permissions = {
  viewFinancials: true,
  tabs: {
    dashboard: true, projects: true, suppliers: true, bills: true, clients: true,
    reports: true, admin: true, uploadBill: true, communications: true, settings: true,
  },
}

export const DEFAULT_VIEWER_PERMISSIONS: Permissions = {
  viewFinancials: false,
  tabs: {
    dashboard: true, projects: true, suppliers: true, bills: false, clients: true,
    reports: false, admin: false, uploadBill: false, communications: false, settings: false,
  },
}

export function parsePermissions(raw: string | null | undefined, role: string): Permissions {
  if (role === 'ADMIN') return ADMIN_PERMISSIONS
  if (!raw) return DEFAULT_VIEWER_PERMISSIONS
  try {
    const parsed = JSON.parse(raw)
    // Merge with defaults to handle missing keys from older stored permissions
    return {
      viewFinancials: parsed.viewFinancials ?? DEFAULT_VIEWER_PERMISSIONS.viewFinancials,
      tabs: { ...DEFAULT_VIEWER_PERMISSIONS.tabs, ...parsed.tabs },
    }
  } catch { return DEFAULT_VIEWER_PERMISSIONS }
}
