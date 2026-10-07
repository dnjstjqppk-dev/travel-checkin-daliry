export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin') || to.path === '/admin/login') return

  try {
    const requestFetch = useRequestFetch()
    await requestFetch('/api/auth/session')
  } catch (error) {
    const statusCode = (error as { statusCode?: number; status?: number }).statusCode
      ?? (error as { status?: number }).status
    if (statusCode === 401) {
      return navigateTo({ path: '/admin/login', query: { redirect: to.fullPath } })
    }
    throw createError({ statusCode: 503, statusMessage: 'Admin authentication service is unavailable' })
  }
})
