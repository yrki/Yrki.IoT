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
