import { describe, expect, it } from 'vitest';
import { joinPath } from './path.ts';

describe('joinPath', () => {
  describe('base path variations', () => {
    it('should return route path when base path is empty', () => {
      expect(joinPath('', '/users')).toBe('/users');
    });

    it('should handle base path without trailing slash', () => {
      expect(joinPath('/api', '/users')).toBe('/api/users');
    });

    it('should handle base path with trailing slash', () => {
      expect(joinPath('/api/', '/users')).toBe('/api/users');
    });
  });

  describe('route path variations', () => {
    it('should return base path when route path is "/"', () => {
      expect(joinPath('/api', '/')).toBe('/api');
    });

    it('should return base path when route path is empty', () => {
      expect(joinPath('/api', '')).toBe('/api');
    });

    it('should handle route path without leading slash', () => {
      expect(joinPath('/api', 'users')).toBe('/api/users');
    });

    it('should handle route path with leading slash', () => {
      expect(joinPath('/api', '/users')).toBe('/api/users');
    });
  });

  describe('combined cases', () => {
    it('should join paths correctly with both having slashes', () => {
      expect(joinPath('/api/v1/', '/users')).toBe('/api/v1/users');
    });

    it('should join paths correctly with neither having slashes', () => {
      expect(joinPath('api', 'users')).toBe('api/users');
    });

    it('should handle root base path', () => {
      expect(joinPath('/', '/users')).toBe('/users');
    });
  });
});
