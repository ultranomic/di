import { describe, expect, it, vi } from 'vite-plus/test';
import { Logger } from './logger.ts';
import { LOG_LEVEL } from './log-level.ts';
import { SCOPE } from './scope.ts';
import { Injectable } from './injectable.ts';

class DepA extends Injectable() {
  public greet() {
    return 'hello';
  }
}

class DebugLogger extends Logger({ name: 'DebugLogger', level: LOG_LEVEL.DEBUG }) {}

class InfoLogger extends Logger({ name: 'InfoLogger' }) {}

class WarnLogger extends Logger({ name: 'WarnLogger', level: LOG_LEVEL.WARN }) {}

class ErrorLogger extends Logger({ name: 'ErrorLogger', level: LOG_LEVEL.ERROR }) {}

class TransientLogger extends Logger({ name: 'TransientLogger', scope: SCOPE.TRANSIENT }) {}

class LoggerWithDeps extends Logger({
  name: 'LoggerWithDeps',
  inject: [['depA', DepA]],
}) {
  public greet() {
    return this.inject.depA.greet();
  }
}

class ChildLogger extends InfoLogger {
  public override info(...args: unknown[]): void {
    super.info('child:', ...args);
  }
}

describe('Logger', () => {
  it('sets static _isLogger to true', () => {
    expect(InfoLogger._isLogger).toBe(true);
  });

  it('sets static _name from config', () => {
    expect(InfoLogger._name).toBe('InfoLogger');
  });

  it('defaults _level to INFO when not provided', () => {
    expect(InfoLogger._level).toBe('INFO');
  });

  it('sets _level correctly when provided', () => {
    expect(DebugLogger._level).toBe('DEBUG');
    expect(WarnLogger._level).toBe('WARN');
    expect(ErrorLogger._level).toBe('ERROR');
  });

  it('defaults _scope to SINGLETON', () => {
    expect(InfoLogger._scope).toBe('SINGLETON');
  });

  it('sets _scope correctly when provided', () => {
    expect(TransientLogger._scope).toBe('TRANSIENT');
  });

  it('sets _inject as empty array when no deps', () => {
    expect(InfoLogger._inject).toEqual([]);
  });

  it('sets _inject correctly with deps', () => {
    expect(LoggerWithDeps._inject).toEqual([['depA', DepA]]);
  });

  it('sets _injectClasses correctly with deps', () => {
    expect(LoggerWithDeps._injectClasses).toEqual([DepA]);
  });

  it('inherits _isInjectable from Injectable', () => {
    expect(InfoLogger._isInjectable).toBe(true);
  });

  it('debug() outputs when level is DEBUG', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new DebugLogger();
    logger.debug('test message');
    expect(spy).toHaveBeenCalledWith('[DebugLogger]', 'test message');
    spy.mockRestore();
  });

  it('debug() is silent when level is INFO', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new InfoLogger();
    logger.debug('test message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('info() outputs when level is INFO', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new InfoLogger();
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith('[InfoLogger]', 'test message');
    spy.mockRestore();
  });

  it('info() is silent when level is WARN', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new WarnLogger();
    logger.info('test message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warn() outputs when level is WARN', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = new WarnLogger();
    logger.warn('test message');
    expect(spy).toHaveBeenCalledWith('[WarnLogger]', 'test message');
    spy.mockRestore();
  });

  it('warn() is silent when level is ERROR', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = new ErrorLogger();
    logger.warn('test message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('error() always outputs', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new ErrorLogger();
    logger.error('test message');
    expect(spy).toHaveBeenCalledWith('[ErrorLogger]', 'test message');
    spy.mockRestore();
  });

  it('prefixes output with [name]', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new InfoLogger();
    logger.info('hello', 'world');
    expect(spy).toHaveBeenCalledWith('[InfoLogger]', 'hello', 'world');
    spy.mockRestore();
  });

  it('works with just name (no other config)', () => {
    class MinimalLogger extends Logger({ name: 'Minimal' }) {}
    expect(MinimalLogger._name).toBe('Minimal');
    expect(MinimalLogger._level).toBe('INFO');
    expect(MinimalLogger._scope).toBe('SINGLETON');
    expect(MinimalLogger._inject).toEqual([]);
  });

  it('inject dependencies are accessible via this.inject', () => {
    const dep = new DepA();
    const logger = new LoggerWithDeps(dep);
    expect(logger.inject.depA.greet()).toBe('hello');
    expect(logger.greet()).toBe('hello');
  });

  it('child class extending a Logger works', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const child = new ChildLogger();
    child.info('msg');
    expect(spy).toHaveBeenCalledWith('[InfoLogger]', 'child:', 'msg');
    spy.mockRestore();
  });
});
