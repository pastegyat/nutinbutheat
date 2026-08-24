export const ADMIN_TOKEN_KEY = 'nbh_admin_token'
export function getAdminToken() { return localStorage.getItem(ADMIN_TOKEN_KEY) ?? '' }
export function clearAdminToken() { localStorage.removeItem(ADMIN_TOKEN_KEY) }