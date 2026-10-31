export const staffRoles = ['admin', 'super_admin', 'editor_in_chief', 'editor', 'reporter', 'translator', 'auditor'] as const
export type StaffRole = typeof staffRoles[number]
export function isStaffRole(value: string): value is StaffRole {
  return (staffRoles as readonly string[]).includes(value)
}
export function canAccessStaff(role: StaffRole, path: string, method: string): boolean {
  if (!path.startsWith('/api/admin/') && path !== '/api/cron/crawl') return true
  if (role === 'admin' || role === 'super_admin') return true
  const resource = path.split('/')[3] || ''
  const read = method === 'GET' || method === 'HEAD'
  if (role === 'auditor') return read && ['logs', 'analytics', 'dashboard-stats'].includes(resource)
  if (role === 'translator') return read && ['articles', 'translations', 'categories'].includes(resource)
  if (role === 'reporter') return (read && ['articles', 'categories', 'media'].includes(resource))
    || (method === 'POST' && path === '/api/admin/articles')
  if (role === 'editor' && method === 'DELETE') return false
  if (role === 'editor') return ['articles', 'categories', 'media', 'translations', 'generate-article'].includes(resource)
    && !/\/(retract|restore|revisions)$/.test(path)
  if (role === 'editor_in_chief') return ['articles', 'review', 'schedules', 'media', 'categories', 'translations', 'dashboard-stats'].includes(resource)
  return false
}
