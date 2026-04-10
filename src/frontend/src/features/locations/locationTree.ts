import type { LocationDto } from '../../api/api';

export interface LocationNode {
  location: LocationDto;
  children: LocationNode[];
}

function compareLocationNames(left: LocationDto, right: LocationDto): number {
  return left.name.localeCompare(right.name, 'nb-NO', { sensitivity: 'base' });
}

export function buildTree(locations: LocationDto[]): LocationNode[] {
  const byId = new Map(locations.map((l) => [l.id, { location: l, children: [] as LocationNode[] }]));
  const roots: LocationNode[] = [];

  for (const node of byId.values()) {
    const parentId = node.location.parentLocationId;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: LocationNode[]) => {
    nodes.sort((a, b) => compareLocationNames(a.location, b.location));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

export function accumulatedDeviceCount(node: LocationNode): number {
  return node.location.deviceCount
    + node.children.reduce((sum, child) => sum + accumulatedDeviceCount(child), 0);
}

export function flattenTree(nodes: LocationNode[], depth = 0): Array<{ location: LocationDto; depth: number }> {
  const result: Array<{ location: LocationDto; depth: number }> = [];
  for (const node of nodes) {
    result.push({ location: node.location, depth });
    result.push(...flattenTree(node.children, depth + 1));
  }
  return result;
}

export function buildLocationOptions(locations: LocationDto[]) {
  return flattenTree(buildTree(locations));
}

export function findLocationNode(nodes: LocationNode[], id: string): LocationNode | null {
  for (const node of nodes) {
    if (node.location.id === id) {
      return node;
    }
    const found = findLocationNode(node.children, id);
    if (found) {
      return found;
    }
  }
  return null;
}

export function collectDescendantLocationIds(node: LocationNode): Set<string> {
  const ids = new Set<string>();
  const walk = (current: LocationNode) => {
    ids.add(current.location.id);
    for (const child of current.children) {
      walk(child);
    }
  };
  walk(node);
  return ids;
}

/**
 * Returns a map from location id to the rolled-up device count for that
 * location (its own deviceCount plus the sum of all descendant device
 * counts), so callers can show one stable count per node without having
 * to traverse the tree themselves.
 */
export function rolledUpDeviceCounts(nodes: LocationNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (node: LocationNode): number => {
    const childTotal = node.children.reduce((sum, child) => sum + walk(child), 0);
    const total = node.location.deviceCount + childTotal;
    counts.set(node.location.id, total);
    return total;
  };
  for (const node of nodes) {
    walk(node);
  }
  return counts;
}
