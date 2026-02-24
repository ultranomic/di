/**
 * Utility functions for path manipulation
 */

/**
 * Join a base path and route path, handling edge cases
 *
 * @param basePath - The base path (e.g., '/api')
 * @param routePath - The route path (e.g., '/users')
 * @returns The combined path (e.g., '/api/users')
 */
export function joinPath(basePath: string, routePath: string): string {
  if (basePath === '') {
    return routePath;
  }
  if (routePath === '/' || routePath === '') {
    return basePath;
  }
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const normalizedRoute = routePath.startsWith('/') ? routePath : '/' + routePath;
  return normalizedBase + normalizedRoute;
}
