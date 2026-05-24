'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Permissions, ADMIN_PERMISSIONS, DEFAULT_VIEWER_PERMISSIONS, parsePermissions } from './permissions'

const PermissionsContext = createContext<Permissions>(ADMIN_PERMISSIONS)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [perms, setPerms] = useState<Permissions>(ADMIN_PERMISSIONS)

  useEffect(() => {
    const role = (session?.user as any)?.role
    if (!role) return
    if (role === 'ADMIN') { setPerms(ADMIN_PERMISSIONS); return }

    // Fetch user's permissions from API
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => setPerms(parsePermissions(d.permissions, role)))
      .catch(() => setPerms(DEFAULT_VIEWER_PERMISSIONS))
  }, [session])

  return <PermissionsContext.Provider value={perms}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
