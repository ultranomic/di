/**
 * Token types for dependency injection
 *
 * Tokens are class constructors that extend Injectable.
 * Replaces the old Token<T> generic type with a simpler Injectable-based type.
 */

import type { Injectable } from './injectable.ts';

/**
 * Token type for provider identification
 *
 * Represents any class constructor that returns an instance extending Injectable.
 * This is the unified type used for all dependency injection tokens.
 */
// oxlint-disable-next-line typescript-eslint/no-explicit-any
export type Token = abstract new (...args: any[]) => Injectable;

/**
 * Helper type to extract the instance type from a token class
 */
export type InstanceTypeOfToken<T extends abstract new (...args: any[]) => any> = InstanceType<T>;
