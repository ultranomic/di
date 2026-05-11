import { DI_ERROR_CODE, DIError } from './di-error.ts';
import { resolveExports } from './module.ts';
import { type Scope, SCOPE } from './scope.ts';
import type { GraphResult, InjectableClass, ModuleClass } from './types.ts';

const VALID_SCOPES = new Set<Scope>(Object.values(SCOPE));

const collectModuleDeps = (
  module: ModuleClass,
  exports: readonly InjectableClass[],
): InjectableClass[] => {
  const moduleProviders = new Set<InjectableClass>(module._combinedProviders);
  const result = new Set<InjectableClass>();

  const trace = (provider: InjectableClass): void => {
    if (result.has(provider)) return;
    if (!moduleProviders.has(provider)) return;
    result.add(provider);
    for (const dep of provider._injectClasses) {
      trace(dep);
    }
  };

  for (const exp of exports) {
    trace(exp);
  }

  return [...result];
};

const collectImports = (
  module: ModuleClass,
  result: Set<InjectableClass>,
  path: Set<ModuleClass>,
  collected: Set<ModuleClass>,
): void => {
  if (path.has(module)) {
    const chain = [...path, module].map((m) => m.name).join(' -> ');
    throw new DIError(
      DI_ERROR_CODE.CIRCULAR_DEPENDENCY,
      `Circular module import detected: ${chain}`,
    );
  }

  if (collected.has(module)) return;

  path.add(module);
  collected.add(module);

  for (const provider of collectModuleDeps(module, resolveExports(module._exports))) {
    result.add(provider);
  }

  for (const imported of module._imports) {
    collectImports(imported, result, path, collected);
  }

  path.delete(module);
};

const collectProviders = (module: ModuleClass): InjectableClass[] => {
  const providerSet = new Set<InjectableClass>(module._combinedProviders);
  const path = new Set<ModuleClass>();
  const collected = new Set<ModuleClass>();

  for (const imported of module._imports) {
    collectImports(imported, providerSet, path, collected);
  }

  return [...providerSet];
};

const buildAdjacencyList = (
  providers: InjectableClass[],
  providerSet: ReadonlySet<InjectableClass>,
): Map<InjectableClass, InjectableClass[]> => {
  const adj = new Map<InjectableClass, InjectableClass[]>();

  for (const provider of providers) {
    const deps: InjectableClass[] = [];
    for (const dep of provider._injectClasses) {
      if (!providerSet.has(dep)) {
        throw new DIError(
          DI_ERROR_CODE.MISSING_PROVIDER,
          `No provider found for ${dep.name}, required by ${provider.name}`,
        );
      }
      deps.push(dep);
    }
    adj.set(provider, deps);
  }

  return adj;
};

const topologicalSort = (adj: Map<InjectableClass, InjectableClass[]>): InjectableClass[] => {
  const sorted: InjectableClass[] = [];
  const visited = new Set<InjectableClass>();
  const inPath = new Set<InjectableClass>();

  const visit = (node: InjectableClass): void => {
    if (inPath.has(node)) {
      // Cycle detected — skip this edge; runtime handles via proxy or throws for transient↔transient
      return;
    }

    if (visited.has(node)) return;

    inPath.add(node);

    const deps = adj.get(node) ?? [];
    for (const dep of deps) {
      visit(dep);
    }

    inPath.delete(node);
    visited.add(node);
    sorted.push(node);
  };

  for (const node of adj.keys()) {
    visit(node);
  }

  return sorted;
};

const validateScope = (sorted: InjectableClass[]): void => {
  const requestDepMap = new Map<InjectableClass, boolean>();

  // Fixpoint iteration: cycles may cause deps to be unprocessed on first pass
  let changed = true;
  while (changed) {
    changed = false;
    for (const provider of sorted) {
      const isRequest = provider._scope === SCOPE.REQUEST;
      const anyDepIsRequest = provider._injectClasses.some(
        (dep) => requestDepMap.get(dep) === true,
      );
      const newValue = isRequest || anyDepIsRequest;
      if (newValue !== (requestDepMap.get(provider) === true)) {
        requestDepMap.set(provider, newValue);
        changed = true;
      }
    }
  }

  for (const provider of sorted) {
    if (!VALID_SCOPES.has(provider._scope)) {
      throw new DIError(
        DI_ERROR_CODE.UNKNOWN_SCOPE,
        `Unknown scope "${String(provider._scope)}" for ${provider.name}`,
      );
    }

    if (provider._scope === SCOPE.SINGLETON) {
      for (const dep of provider._injectClasses) {
        if (dep._scope === SCOPE.REQUEST) {
          throw new DIError(
            DI_ERROR_CODE.SCOPE_VIOLATION,
            `Scope violation: ${provider.name} (singleton) depends on ${dep.name} (request)`,
          );
        }
        if (requestDepMap.get(dep) === true) {
          throw new DIError(
            DI_ERROR_CODE.SCOPE_VIOLATION,
            `Scope violation: ${provider.name} (singleton) transitively depends on a request-scoped provider via ${dep.name}`,
          );
        }
      }
    }
  }
};

/**
 * Build and validate the dependency graph from a module tree.
 * @param {ModuleClass} module - The root module class to build the graph from.
 * @returns {GraphResult} The resolved graph with a topologically sorted provider list.
 * @throws {DIError} With code CIRCULAR_DEPENDENCY when circular module imports are detected.
 * @throws {DIError} With code MISSING_PROVIDER when a dependency is not registered in any reachable module.
 * @throws {DIError} With code SCOPE_VIOLATION when a singleton depends on a request-scoped provider.
 * @throws {DIError} With code UNKNOWN_SCOPE when a provider has an unrecognized scope value.
 */
export const buildGraph = (module: ModuleClass): GraphResult => {
  const allProviders = collectProviders(module);
  const providerSet = new Set<InjectableClass>(allProviders);
  const adjList = buildAdjacencyList(allProviders, providerSet);
  const sorted = topologicalSort(adjList);
  validateScope(sorted);

  return { sorted: Object.freeze(sorted) };
};
