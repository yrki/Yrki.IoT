import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import BimSidePanel from './BimSidePanel';
import { getSensorActivityHex } from '../sensors/sensorActivity';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as WebIFC from 'web-ifc';
import {
  applyBuildingStructureChanges,
  assignDeviceToBuilding,
  assignDeviceToRoom,
  BimStructureDiff,
  createDevice,
  createFloor,
  createRoom,
  deleteFloor,
  deleteRoom,
  FloorDto,
  getBuilding,
  getBuildingDevices,
  getBuildingFloors,
  getBuildingIfcUrl,
  getDevices,
  ImportFloorEntry,
  importBuildingStructure,
  SensorListItemDto,
  updateFloor,
  updateRoom,
} from '../../api/api';
import type { StoreyInfo as PanelStoreyInfo, RoomInfo as PanelRoomInfo } from './BimSidePanel';

interface StoreyInfo {
  id: number;
  name: string;
  elevation: number;
  group: THREE.Group;
}

interface RoomInfo {
  expressId: number;
  number: string;
  name: string;
  center: THREE.Vector3 | null;
  size: THREE.Vector3 | null;
  storeyId: number | null;
  meshes: THREE.Mesh[];
}

interface BimViewProps {
  buildingId: string;
  onBack: () => void;
  onSwitchToStructure?: () => void;
}

function BimView({ buildingId, onBack, onSwitchToStructure }: BimViewProps) {
  const ifcUrl = getBuildingIfcUrl(buildingId);
  const [buildingName, setBuildingName] = useState(buildingId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storeys, setStoreys] = useState<StoreyInfo[]>([]);
  const [activeStorey, setActiveStorey] = useState<number | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [apiFloors, setApiFloors] = useState<FloorDto[]>([]);
  const [structureDiff, setStructureDiff] = useState<BimStructureDiff | null>(null);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const ifcStructureRef = useRef<ImportFloorEntry[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomInfo | null>(null);
  const prevRoomMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material>>(new Map());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const [ambientIntensity, setAmbientIntensity] = useState(0.25);
  const [shadowIntensity, setShadowIntensity] = useState(1.2);

  // Device placement (room-based)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRoom, setDialogRoom] = useState<RoomInfo | null>(null);
  const [dialogApiRoomId, setDialogApiRoomId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<'existing' | 'new'>('existing');
  const [allDevices, setAllDevices] = useState<SensorListItemDto[]>([]);
  const [placedDevices, setPlacedDevices] = useState<Array<{ device: SensorListItemDto; position: THREE.Vector3; roomExpressId: number }>>([]);
  const [searchDevice, setSearchDevice] = useState<SensorListItemDto | null>(null);
  const [newUniqueId, setNewUniqueId] = useState('');
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const deviceMarkersRef = useRef<THREE.Mesh[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const initialCameraPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const initialTarget = useRef<THREE.Vector3>(new THREE.Vector3());

  // Fetch building name + devices
  // Load building name, all devices (for search), and placed devices (for markers)
  useEffect(() => {
    getBuilding(buildingId)
      .then((b) => setBuildingName(b.name))
      .catch(() => {});
    getDevices()
      .then(setAllDevices)
      .catch(() => {});
  }, [buildingId]);

  const createDeviceMarker = useCallback((position: THREE.Vector3, color: number = 0x22c55e) => {
    const geo = new THREE.SphereGeometry(0.3, 16, 16);
    const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
    const marker = new THREE.Mesh(geo, mat);
    marker.position.copy(position);
    marker.castShadow = true;
    return marker;
  }, []);

  // Find the storey group a Y position belongs to
  const findStoreyGroupForY = useCallback((y: number): THREE.Group | null => {
    for (const storey of storeys) {
      // Use the storey elevation ranges
      const nextStorey = storeys.find((s) => s.elevation > storey.elevation);
      const maxY = nextStorey ? nextStorey.elevation : Infinity;
      if (y >= storey.elevation && y < maxY) {
        return storey.group;
      }
    }
    return null;
  }, [storeys]);

  const addMarkerToScene = useCallback((marker: THREE.Mesh) => {
    const group = findStoreyGroupForY(marker.position.y);
    if (group) {
      group.add(marker);
    } else {
      sceneRef.current?.add(marker);
    }
  }, [findStoreyGroupForY]);

  // Load already-placed devices from backend and create 3D markers
  const loadPlacedDevices = useCallback(async () => {
    try {
      const devs = await getBuildingDevices(buildingId);
      const placed = devs
        .filter((d) => d.bimX != null && d.bimY != null && d.bimZ != null)
        .map((d) => {
          const pos = new THREE.Vector3(d.bimX!, d.bimY!, d.bimZ!);
          let bestRoom = 0;
          let bestDist = Infinity;
          for (const room of rooms) {
            if (room.center) {
              const dist = pos.distanceTo(room.center);
              if (dist < bestDist) {
                bestDist = dist;
                bestRoom = room.expressId;
              }
            }
          }
          return {
            device: {
              id: d.id, uniqueId: d.uniqueId, name: d.name, manufacturer: d.manufacturer,
              type: d.type, kind: d.kind as 'Sensor' | 'Gateway' | undefined,
              locationName: null, locationId: null,
              lastContact: d.lastContact, installationDate: d.lastContact,
              latitude: null, longitude: null,
            } satisfies SensorListItemDto,
            position: pos,
            roomExpressId: bestRoom,
          };
        });
      setPlacedDevices(placed);

      const scene = sceneRef.current;
      if (scene) {
        for (const m of deviceMarkersRef.current) m.parent?.remove(m);
        deviceMarkersRef.current = [];
        for (const pd of placed) {
          const color = getSensorActivityHex(pd.device.lastContact, Date.now());
          const marker = createDeviceMarker(pd.position, color);
          addMarkerToScene(marker);
          deviceMarkersRef.current.push(marker);
        }
      }
    } catch (err) {
      console.error('Failed to load building devices:', err);
    }
  }, [buildingId, rooms, createDeviceMarker, addMarkerToScene]);

  const resetView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    // Clear room highlight
    for (const [mesh, mat] of prevRoomMaterialsRef.current) {
      mesh.material = mat;
    }
    prevRoomMaterialsRef.current.clear();
    setSelectedRoom(null);
    setActiveStorey(null);

    camera.position.copy(initialCameraPos.current);
    controls.target.copy(initialTarget.current);
    camera.updateProjectionMatrix();
    controls.update();
  };

  const highlightMaterial = useRef(new THREE.MeshPhongMaterial({
    color: 0xe53935,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
    emissive: 0xe53935,
    emissiveIntensity: 0.3,
  }));

  const navigateToRoom = (room: RoomInfo) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !room.center) return;

    // Restore previous room's materials
    for (const [mesh, mat] of prevRoomMaterialsRef.current) {
      mesh.material = mat;
    }
    prevRoomMaterialsRef.current.clear();

    // Highlight all meshes belonging to this room
    for (const mesh of room.meshes) {
      prevRoomMaterialsRef.current.set(mesh, mesh.material as THREE.Material);
      mesh.material = highlightMaterial.current;
    }

    setSelectedRoom(room);

    // Switch to the room's storey so only that floor is visible
    if (room.storeyId != null) {
      setActiveStorey(room.storeyId);
    }

    // Near-top-down view centered on the room (slightly angled to avoid gimbal lock)
    const maxDim = room.size ? Math.max(room.size.x, room.size.z) : 5;
    const distance = Math.max(maxDim * 2.5, 8);

    controls.target.copy(room.center);
    camera.up.set(0, 1, 0);
    camera.position.set(room.center.x, room.center.y + distance, room.center.z + 0.5);
    camera.updateProjectionMatrix();
    controls.update();
  };

  const topView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    // Clear room highlight
    for (const [mesh, mat] of prevRoomMaterialsRef.current) {
      mesh.material = mat;
    }
    prevRoomMaterialsRef.current.clear();
    setSelectedRoom(null);
    setActiveStorey(null);

    // Reset to initial camera position and target (model center)
    camera.up.set(0, 1, 0);
    controls.target.copy(initialTarget.current);
    camera.position.copy(initialCameraPos.current);
    camera.updateProjectionMatrix();
    controls.update();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000,
    );
    camera.position.set(30, 20, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 5, 0);
    controls.listenToKeyEvents(window);
    controls.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };
    controls.keyPanSpeed = 15;
    // Prevent camera roll (z-axis rotation) — keep camera upright
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI / 2;

    cameraRef.current = camera;
    controlsRef.current = controls;

    // Low ambient so shadows and material colors are visible
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);
    ambientRef.current = ambient;

    // Strong directional for sharp shadows
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(80, 120, 60);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 500;
    dir.shadow.camera.left = -100;
    dir.shadow.camera.right = 100;
    dir.shadow.camera.top = 100;
    dir.shadow.camera.bottom = -100;
    dir.shadow.bias = -0.001;
    scene.add(dir);
    dirLightRef.current = dir;

    // Fill light from opposite side (softer)
    const fill = new THREE.DirectionalLight(0xc4d4e0, 0.4);
    fill.position.set(-40, 30, -50);
    scene.add(fill);

    // Hemisphere for subtle sky/ground tint
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3));
    scene.add(new THREE.GridHelper(200, 100, 0x334155, 0x1e293b));

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || disposed) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // --- Load IFC ---
    const loadIfc = async () => {
      try {
        setProgress('Initialising IFC engine...');
        const ifcApi = new WebIFC.IfcAPI();
        ifcApi.SetWasmPath('/');
        await ifcApi.Init();
        if (disposed) return;

        setProgress('Fetching IFC file...');
        const response = await fetch(ifcUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (disposed) return;

        setProgress('Parsing model...');
        const modelID = ifcApi.OpenModel(new Uint8Array(buffer));

        // --- Extract building storeys ---
        setProgress('Reading building storeys...');
        const storeyIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCBUILDINGSTOREY);
        const storeyList: { id: number; name: string; elevation: number }[] = [];
        for (let i = 0; i < storeyIds.size(); i++) {
          const sid = storeyIds.get(i);
          const props = ifcApi.GetLine(modelID, sid);
          storeyList.push({
            id: sid,
            name: props.Name?.value ?? `Storey ${i + 1}`,
            elevation: props.Elevation?.value ?? 0,
          });
        }
        storeyList.sort((a, b) => a.elevation - b.elevation);

        // Calculate elevation ranges for each storey
        const storeyRanges = storeyList.map((s, i) => ({
          ...s,
          minY: s.elevation,
          maxY: i < storeyList.length - 1 ? storeyList[i + 1].elevation : Infinity,
        }));

        // Create a THREE.Group per storey + one for "unassigned"
        const storeyGroups = storeyRanges.map((s) => ({
          ...s,
          group: new THREE.Group(),
        }));
        const unassignedGroup = new THREE.Group();
        for (const sg of storeyGroups) scene.add(sg.group);
        scene.add(unassignedGroup);

        // --- Build element type lookup ---
        setProgress('Indexing element types...');
        const elementTypeMap = new Map<number, number>();
        const ifcTypeIds = [
          WebIFC.IFCWALL, WebIFC.IFCWALLSTANDARDCASE,
          WebIFC.IFCSLAB,
          WebIFC.IFCDOOR,
          WebIFC.IFCWINDOW,
          WebIFC.IFCCOLUMN,
          WebIFC.IFCBEAM,
          WebIFC.IFCROOF,
          WebIFC.IFCSTAIR, WebIFC.IFCSTAIRFLIGHT,
          WebIFC.IFCRAILING,
          WebIFC.IFCFURNISHINGELEMENT,
          WebIFC.IFCPLATE,
          WebIFC.IFCCURTAINWALL,
          WebIFC.IFCMEMBER,
          WebIFC.IFCCOVERING,
          WebIFC.IFCSPACE,
        ];
        for (const typeId of ifcTypeIds) {
          try {
            const ids = ifcApi.GetLineIDsWithType(modelID, typeId);
            for (let i = 0; i < ids.size(); i++) {
              elementTypeMap.set(ids.get(i), typeId);
            }
          } catch {
            // Type not present in model
          }
        }

        // Material per element type for strong contrast
        // High-contrast BIM palette with shadow support
        const mat = (color: number, opts?: { transparent?: boolean; opacity?: number }) =>
          new THREE.MeshPhongMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: opts?.transparent ?? false,
            opacity: opts?.opacity ?? 1,
            specular: 0x222222,
            shininess: 15,
          });

        const typeMaterials: Record<number, THREE.Material> = {
          // Walls — warm cream, clearly distinct from dark floor
          [WebIFC.IFCWALL]:             mat(0xf2e6d0),
          [WebIFC.IFCWALLSTANDARDCASE]: mat(0xf2e6d0),
          // Slabs/floors — very dark concrete, maximum contrast vs walls
          [WebIFC.IFCSLAB]:             mat(0x3a3a3a),
          // Doors — rich walnut brown
          [WebIFC.IFCDOOR]:             mat(0x6d3a1f),
          // Windows — clear blue glass
          [WebIFC.IFCWINDOW]:           mat(0x6ab4d6, { transparent: true, opacity: 0.3 }),
          // Columns — teal steel, pops against walls
          [WebIFC.IFCCOLUMN]:           mat(0x2a6478),
          // Beams — dark structural steel
          [WebIFC.IFCBEAM]:             mat(0x1e4d5c),
          // Roof — burnt sienna
          [WebIFC.IFCROOF]:             mat(0x7a3b1e),
          // Stairs — warm sandstone
          [WebIFC.IFCSTAIR]:            mat(0xb8956a),
          [WebIFC.IFCSTAIRFLIGHT]:      mat(0xb8956a),
          // Railings — charcoal metal
          [WebIFC.IFCRAILING]:          mat(0x252525),
          // Furniture — amber wood
          [WebIFC.IFCFURNISHINGELEMENT]: mat(0xc4882e),
          // Plates — brushed aluminium
          [WebIFC.IFCPLATE]:            mat(0x9aabb8),
          // Curtain walls — deep tinted glass
          [WebIFC.IFCCURTAINWALL]:      mat(0x3d8ab4, { transparent: true, opacity: 0.25 }),
          // Members — slate structural
          [WebIFC.IFCMEMBER]:           mat(0x4a5568),
          // Coverings — off-white plaster
          [WebIFC.IFCCOVERING]:         mat(0xd9d0c4),
          // Spaces — barely visible room volumes
          [WebIFC.IFCSPACE]:            mat(0xb8d0e0, { transparent: true, opacity: 0.08 }),
        };
        const defaultMaterial = mat(0xa09888);

        // --- Build geometry ---
        setProgress('Building geometry...');
        const meshByExpressId = new Map<number, THREE.Mesh>();
        const spaceMeshes = new Map<number, THREE.Mesh[]>();

        ifcApi.StreamAllMeshes(modelID, (mesh: WebIFC.FlatMesh) => {
          const placedGeometries = mesh.geometries;
          const elementType = elementTypeMap.get(mesh.expressID);

          for (let i = 0; i < placedGeometries.size(); i++) {
            const pg = placedGeometries.get(i);
            const geomData = ifcApi.GetGeometry(modelID, pg.geometryExpressID);

            const verts = ifcApi.GetVertexArray(geomData.GetVertexData(), geomData.GetVertexDataSize());
            const indices = ifcApi.GetIndexArray(geomData.GetIndexData(), geomData.GetIndexDataSize());

            const geometry = new THREE.BufferGeometry();
            const posFloats = new Float32Array(verts.length / 2);
            const normFloats = new Float32Array(verts.length / 2);

            for (let j = 0; j < verts.length; j += 6) {
              const idx = j / 2;
              posFloats[idx] = verts[j];
              posFloats[idx + 1] = verts[j + 1];
              posFloats[idx + 2] = verts[j + 2];
              normFloats[idx] = verts[j + 3];
              normFloats[idx + 1] = verts[j + 4];
              normFloats[idx + 2] = verts[j + 5];
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(posFloats, 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(normFloats, 3));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));

            const material = elementType != null
              ? (typeMaterials[elementType] ?? defaultMaterial)
              : defaultMaterial;

            const threeMesh = new THREE.Mesh(geometry, material);
            threeMesh.castShadow = true;
            threeMesh.receiveShadow = true;
            const matrix = new THREE.Matrix4();
            matrix.fromArray(pg.flatTransformation);
            threeMesh.applyMatrix4(matrix);

            // Track first mesh per element for room navigation
            if (!meshByExpressId.has(mesh.expressID)) {
              meshByExpressId.set(mesh.expressID, threeMesh);
            }

            // Collect all IFCSPACE meshes for highlighting
            if (elementType === WebIFC.IFCSPACE) {
              const existing = spaceMeshes.get(mesh.expressID);
              if (existing) {
                existing.push(threeMesh);
              } else {
                spaceMeshes.set(mesh.expressID, [threeMesh]);
              }
            }

            // Assign to storey based on bounding box center Y
            geometry.computeBoundingBox();
            const bbox = new THREE.Box3().setFromObject(threeMesh);
            const centerY = (bbox.min.y + bbox.max.y) / 2;

            let assigned = false;
            for (const sg of storeyGroups) {
              if (centerY >= sg.minY && centerY < sg.maxY) {
                sg.group.add(threeMesh);
                assigned = true;
                break;
              }
            }
            if (!assigned) {
              unassignedGroup.add(threeMesh);
            }

            geomData.delete();
          }
        });

        // --- Extract rooms (IFCSPACE) with geometry ---
        setProgress('Reading rooms...');
        const roomList: RoomInfo[] = [];
        try {
          const spaceIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCSPACE);
          for (let i = 0; i < spaceIds.size(); i++) {
            const sid = spaceIds.get(i);
            const props = ifcApi.GetLine(modelID, sid);
            const number = props.Name?.value ?? '';
            const longName = props.LongName?.value ?? props.Description?.value ?? '';
            const label = longName
              ? `${number} — ${longName}`
              : number || `Space ${i + 1}`;

            // Try multiple strategies to find room geometry
            let roomMeshes = spaceMeshes.get(sid) ?? [];
            let center: THREE.Vector3 | null = null;
            let size: THREE.Vector3 | null = null;

            // Strategy 1: meshes collected during StreamAllMeshes
            if (roomMeshes.length > 0) {
              const box = new THREE.Box3();
              for (const m of roomMeshes) box.expandByObject(m);
              if (!box.isEmpty()) {
                center = box.getCenter(new THREE.Vector3());
                size = box.getSize(new THREE.Vector3());
              }
            }

            // Strategy 2: GetFlatMesh to compute center, then find nearby scene meshes
            if (!center) {
              try {
                const flatMesh = ifcApi.GetFlatMesh(modelID, sid);
                const geos = flatMesh.geometries;
                if (geos.size() > 0) {
                  const pg = geos.get(0);
                  const geomData = ifcApi.GetGeometry(modelID, pg.geometryExpressID);
                  const verts = ifcApi.GetVertexArray(geomData.GetVertexData(), geomData.GetVertexDataSize());

                  // Compute center from vertices
                  const posCount = verts.length / 6;
                  if (posCount > 0) {
                    let cx = 0, cy = 0, cz = 0;
                    for (let j = 0; j < verts.length; j += 6) {
                      cx += verts[j]; cy += verts[j + 1]; cz += verts[j + 2];
                    }
                    const tempCenter = new THREE.Vector3(cx / posCount, cy / posCount, cz / posCount);

                    // Apply transform
                    const matrix = new THREE.Matrix4();
                    matrix.fromArray(pg.flatTransformation);
                    tempCenter.applyMatrix4(matrix);

                    center = tempCenter;
                    size = new THREE.Vector3(5, 3, 5); // default room size estimate

                    // Find scene meshes near this center (within 2m) to use for highlighting
                    const nearbyMeshes: THREE.Mesh[] = [];
                    scene.traverse((obj) => {
                      if (obj instanceof THREE.Mesh && obj.geometry) {
                        const meshBox = new THREE.Box3().setFromObject(obj);
                        const meshCenter = meshBox.getCenter(new THREE.Vector3());
                        if (meshCenter.distanceTo(tempCenter) < 2) {
                          nearbyMeshes.push(obj);
                        }
                      }
                    });
                    if (nearbyMeshes.length > 0) {
                      roomMeshes = nearbyMeshes;
                    }
                  }
                  geomData.delete();
                }
              } catch {
                // GetFlatMesh failed
              }
            }

            // Link to storey by elevation
            let storeyId: number | null = null;
            if (center) {
              for (const sg of storeyGroups) {
                if (center.y >= sg.minY && center.y < sg.maxY) {
                  storeyId = sg.id;
                  break;
                }
              }
            }

            roomList.push({ expressId: sid, number, name: label, center, size, storeyId, meshes: roomMeshes });
          }
          roomList.sort((a, b) => a.name.localeCompare(b.name));
        } catch {
          // No spaces in model
        }

        ifcApi.CloseModel(modelID);
        if (disposed) return;

        // Center camera
        const box = new THREE.Box3();
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) box.expandByObject(obj);
        });
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          controls.target.copy(center);
          camera.position.set(center.x + maxDim * 0.8, center.y + maxDim * 0.6, center.z + maxDim * 0.8);
          camera.far = maxDim * 10;
          camera.updateProjectionMatrix();
          controls.update();

          initialCameraPos.current.copy(camera.position);
          initialTarget.current.copy(controls.target);

          // Fit shadow camera to model bounds
          dir.shadow.camera.left = -maxDim;
          dir.shadow.camera.right = maxDim;
          dir.shadow.camera.top = maxDim;
          dir.shadow.camera.bottom = -maxDim;
          dir.shadow.camera.far = maxDim * 5;
          dir.target.position.copy(center);
          dir.shadow.camera.updateProjectionMatrix();
        }

        setStoreys(storeyGroups.map((sg) => ({
          id: sg.id,
          name: sg.name,
          elevation: sg.elevation,
          group: sg.group,
        })));
        setRooms(roomList);

        // Build IFC structure for import
        const ifcStructure = storeyList.map((s) => {
          const storeyRooms = roomList.filter((r) => r.storeyId === s.id);
          return {
            name: s.name,
            elevation: s.elevation,
            bimExpressId: s.id,
            rooms: storeyRooms.map((r) => ({
              name: r.name,
              number: r.number || undefined,
              bimExpressId: r.expressId,
            })),
          };
        });
        ifcStructureRef.current = ifcStructure;

        // Import structure (first time auto-creates, subsequent returns diff)
        importBuildingStructure(buildingId, ifcStructure)
          .then((diff) => {
            if (diff.hasChanges) {
              setStructureDiff(diff);
              setDiffDialogOpen(true);
            }
          })
          .catch(() => {});

        // Load persisted floors from API
        getBuildingFloors(buildingId).then(setApiFloors).catch(() => {});

        setLoading(false);
      } catch (err: unknown) {
        if (!disposed) {
          console.error('Failed to load IFC model:', err);
          setError(`Failed to load the BIM model: ${err instanceof Error ? err.message : 'unknown error'}`);
          setLoading(false);
        }
      }
    };

    loadIfc();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load placed devices after model is ready
  useEffect(() => {
    if (!loading && sceneRef.current) {
      loadPlacedDevices();
    }
  }, [loading, loadPlacedDevices]);

  // Sync light sliders
  useEffect(() => {
    if (ambientRef.current) ambientRef.current.intensity = ambientIntensity;
  }, [ambientIntensity]);

  useEffect(() => {
    if (dirLightRef.current) dirLightRef.current.intensity = shadowIntensity;
  }, [shadowIntensity]);

  // Toggle storey visibility
  useEffect(() => {
    for (const storey of storeys) {
      storey.group.visible = activeStorey === null || storey.id === activeStorey;
    }
  }, [activeStorey, storeys]);

  // Add device to a room (from side panel)
  const openAddDeviceDialog = useCallback((room: RoomInfo | null, apiRoomId?: string) => {
    setDialogRoom(room);
    setDialogApiRoomId(apiRoomId ?? null);
    setDialogMode('existing');
    setSearchDevice(null);
    setNewUniqueId('');
    setNewManufacturer('');
    setNewName('');
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const handlePlaceDeviceInRoom = async () => {
    setSaving(true);
    setDialogError(null);

    try {
      let device: SensorListItemDto;

      if (dialogMode === 'existing') {
        if (!searchDevice) return;
        device = searchDevice;
      } else {
        if (!newUniqueId.trim() || !newManufacturer.trim()) return;
        // Create new device
        try {
          device = await createDevice(
            newUniqueId.trim(),
            newManufacturer.trim(),
            newName.trim() || undefined,
          );
          setAllDevices((prev) => [...prev, device]);
        } catch (err: unknown) {
          setDialogError('A device with this unique ID already exists. Use "Find existing" instead.');
          setSaving(false);
          return;
        }
      }

      const center = dialogRoom?.center;

      // Find the API room ID: prefer explicit dialogApiRoomId, else match by BimExpressId
      const apiRoomId = dialogApiRoomId
        ?? apiFloors.flatMap((f) => f.rooms).find(
            (r) => dialogRoom && r.bimExpressId === dialogRoom.expressId,
          )?.id;

      if (apiRoomId) {
        await assignDeviceToRoom(
          buildingId, device.id, apiRoomId,
          center?.x, center?.y, center?.z,
        );
      } else {
        await assignDeviceToBuilding(
          device.id, buildingId,
          center?.x, center?.y, center?.z,
        );
      }

      if (center) {
        const activityColor = getSensorActivityHex(device.lastContact, Date.now());
        const marker = createDeviceMarker(center, activityColor);
        addMarkerToScene(marker);
        deviceMarkersRef.current.push(marker);
      }

      setPlacedDevices((prev) => [...prev, {
        device,
        position: center ?? new THREE.Vector3(),
        roomExpressId: dialogRoom?.expressId ?? 0,
      }]);

      setDialogOpen(false);
      setDialogRoom(null);
      setDialogApiRoomId(null);
      setSearchDevice(null);
    } catch (err) {
      console.error('Failed to place device:', err);
      setDialogError('Failed to assign device to room.');
    } finally {
      setSaving(false);
    }
  };

  const cancelDialog = () => {
    setDialogOpen(false);
    setDialogRoom(null);
    setSearchDevice(null);
    setDialogError(null);
  };

  const deviceOptions = useMemo(() =>
    allDevices.filter((d) => d.kind !== 'Gateway'),
    [allDevices],
  );

  // Structure editing callbacks for BimSidePanel
  const reloadApiFloors = async () => {
    const floors = await getBuildingFloors(buildingId);
    setApiFloors(floors);
  };

  const handleAddFloor = async (name: string) => {
    await createFloor(buildingId, name);
    await reloadApiFloors();
  };

  const handleEditFloor = async (storey: PanelStoreyInfo, name: string) => {
    if (!storey.apiId) return;
    const floor = apiFloors.find((f) => f.id === storey.apiId);
    await updateFloor(buildingId, storey.apiId, name, floor?.elevation ?? 0);
    await reloadApiFloors();
  };

  const handleDeleteFloor = async (storey: PanelStoreyInfo) => {
    if (!storey.apiId) return;
    await deleteFloor(buildingId, storey.apiId);
    await reloadApiFloors();
  };

  const handleAddRoom = async (storey: PanelStoreyInfo, name: string, number?: string) => {
    if (!storey.apiId) return;
    await createRoom(buildingId, storey.apiId, name, number);
    await reloadApiFloors();
  };

  const handleEditRoom = async (room: PanelRoomInfo, name: string, number?: string) => {
    if (!room.apiId) return;
    const floorId = apiFloors.find((f) => f.rooms.some((r) => r.id === room.apiId))?.id;
    if (!floorId) return;
    await updateRoom(buildingId, floorId, room.apiId, name, number ?? null);
    await reloadApiFloors();
  };

  const handleDeleteRoom = async (room: PanelRoomInfo) => {
    if (!room.apiId) return;
    const floorId = apiFloors.find((f) => f.rooms.some((r) => r.id === room.apiId))?.id;
    if (!floorId) return;
    await deleteRoom(buildingId, floorId, room.apiId);
    await reloadApiFloors();
  };

  return (
    <Paper
      sx={{
        borderRadius: '6px',
        backgroundColor: 'rgba(36, 42, 51, 0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
      }}
    >
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(15, 23, 42, 0.36)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Button size="small" variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>
          Back
        </Button>
        <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{buildingName}</Typography>

        <Box sx={{ flexGrow: 1 }} />

        {onSwitchToStructure && (
          <Button size="small" variant="outlined" startIcon={<GridViewRoundedIcon />} onClick={onSwitchToStructure}>
            Schematic
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
      {/* 3D viewport (left) */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Navigation legend + view controls */}
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 10,
            p: 1.5,
            borderRadius: '8px',
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button size="small" variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={topView} sx={{ fontSize: '0.7rem' }}>
              Reset view
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: 'text.secondary' }}>
            LIGHTING
          </Typography>
          <Stack spacing={0.5} sx={{ mb: 1.5, minWidth: 160 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', minWidth: 55 }}>
                Ambient
              </Typography>
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={ambientIntensity}
                onChange={(_, v) => setAmbientIntensity(v as number)}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', minWidth: 55 }}>
                Shadows
              </Typography>
              <Slider
                size="small"
                min={0}
                max={3}
                step={0.1}
                value={shadowIntensity}
                onChange={(_, v) => setShadowIntensity(v as number)}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>

          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: 'text.secondary' }}>
            NAVIGATION
          </Typography>
          <Stack spacing={0.25}>
            {[
              { key: 'Scroll', action: 'Zoom in/out' },
              { key: 'Left drag', action: 'Rotate' },
              { key: 'Right drag', action: 'Pan' },
              { key: '← → ↑ ↓', action: 'Pan' },
            ].map(({ key, action }) => (
              <Stack key={key} direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, minWidth: 80, fontSize: '0.7rem' }}>
                  {key}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  {action}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>

        {loading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
            }}
          >
            <CircularProgress size={40} />
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              {progress || 'Loading BIM model...'}
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

        <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />

      </Box>

      {/* Side panel (right) */}
      <BimSidePanel
        storeys={apiFloors.length > 0
          ? apiFloors.map((f) => ({ id: f.bimExpressId ?? 0, name: f.name, apiId: f.id }))
          : storeys.map((s) => ({ id: s.id, name: s.name }))}
        rooms={apiFloors.length > 0
          ? apiFloors.flatMap((f) => f.rooms.map((r) => ({
              expressId: r.bimExpressId ?? 0,
              name: r.number ? `${r.number} — ${r.name}` : r.name,
              storeyId: f.bimExpressId ?? 0,
              apiId: r.id,
            })))
          : rooms.map((r) => ({ expressId: r.expressId, name: r.name, storeyId: r.storeyId }))}
        placedDevices={placedDevices.map((pd) => ({
          deviceId: pd.device.id,
          uniqueId: pd.device.uniqueId,
          name: pd.device.name,
          type: pd.device.type,
          lastContact: pd.device.lastContact,
          roomExpressId: pd.roomExpressId,
        }))}
        activeStorey={activeStorey}
        onSelectStorey={setActiveStorey}
        onSelectRoom={(room) => {
          const full = rooms.find((r) => r.expressId === room.expressId);
          if (full) navigateToRoom(full);
        }}
        onLocateDevice={(dev) => {
          const placed = placedDevices.find((pd) => pd.device.id === dev.deviceId);
          if (placed) {
            const camera = cameraRef.current;
            const controls = controlsRef.current;
            if (camera && controls) {
              controls.target.copy(placed.position);
              // Near-top-down view centered on the device
              camera.up.set(0, 1, 0);
              camera.position.set(placed.position.x, placed.position.y + 15, placed.position.z + 0.5);
              camera.updateProjectionMatrix();
              controls.update();
            }
          }
        }}
        onAddDeviceToRoom={(room) => {
          const full = rooms.find((r) => r.expressId === room.expressId);
          if (full) {
            openAddDeviceDialog(full, room.apiId);
          } else if (room.apiId) {
            // Room has no IFC geometry but exists in API — open dialog without 3D placement
            openAddDeviceDialog(null, room.apiId);
          }
        }}
        onRemoveDevice={(dev) => {
          const idx = placedDevices.findIndex((pd) => pd.device.id === dev.deviceId);
          if (idx >= 0) {
            const marker = deviceMarkersRef.current[idx];
            if (marker) {
              marker.parent?.remove(marker);
              marker.geometry.dispose();
              deviceMarkersRef.current.splice(idx, 1);
            }
            assignDeviceToBuilding(dev.deviceId, buildingId, undefined, undefined, undefined)
              .catch((err) => console.error('Failed to unassign device:', err));
            setPlacedDevices((prev) => prev.filter((_, i) => i !== idx));
          }
        }}
        onShowSensorData={(uniqueId) => {
          window.open(`/sensors/${encodeURIComponent(uniqueId)}`, '_blank');
        }}
        onAddFloor={handleAddFloor}
        onEditFloor={handleEditFloor}
        onDeleteFloor={handleDeleteFloor}
        onAddRoom={handleAddRoom}
        onEditRoom={handleEditRoom}
        onDeleteRoom={handleDeleteRoom}
      />
      </Box>

      {/* Add device to room dialog */}
      <Dialog open={dialogOpen} onClose={cancelDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add sensor to {dialogRoom?.name ?? dialogApiRoomId ? 'room' : 'building'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <ButtonGroup size="small" fullWidth>
            <Button
              variant={dialogMode === 'existing' ? 'contained' : 'outlined'}
              onClick={() => { setDialogMode('existing'); setDialogError(null); }}
            >
              Find existing
            </Button>
            <Button
              variant={dialogMode === 'new' ? 'contained' : 'outlined'}
              onClick={() => { setDialogMode('new'); setDialogError(null); }}
            >
              Create new
            </Button>
          </ButtonGroup>

          {dialogMode === 'existing' ? (
            <Autocomplete
              options={deviceOptions}
              value={searchDevice}
              onChange={(_, v) => setSearchDevice(v)}
              getOptionLabel={(opt) => `${opt.uniqueId}${opt.name ? ` — ${opt.name}` : ''}`}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              renderInput={(params) => (
                <TextField {...params} label="Search device" placeholder="Type to search..." autoFocus />
              )}
              renderOption={(props, opt) => (
                <li {...props} key={opt.id}>
                  <Stack>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{opt.uniqueId}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[opt.name, opt.manufacturer, opt.type].filter(Boolean).join(' · ')}
                    </Typography>
                  </Stack>
                </li>
              )}
            />
          ) : (
            <>
              <TextField
                label="Unique ID"
                value={newUniqueId}
                onChange={(e) => setNewUniqueId(e.target.value)}
                required
                autoFocus
                placeholder="e.g. 00148032"
              />
              <TextField
                label="Manufacturer"
                value={newManufacturer}
                onChange={(e) => setNewManufacturer(e.target.value)}
                required
                placeholder="e.g. ABB"
                inputProps={{ minLength: 1 }}
              />
              <TextField
                label="Name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Office water meter"
              />
            </>
          )}

          {dialogError && (
            <Typography variant="body2" color="error">{dialogError}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePlaceDeviceInRoom}
            disabled={
              saving ||
              (!dialogRoom?.center && !dialogApiRoomId) ||
              (dialogMode === 'existing' && !searchDevice) ||
              (dialogMode === 'new' && (!newUniqueId.trim() || !newManufacturer.trim()))
            }
          >
            {saving ? 'Adding...' : 'Add to room'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* BIM structure diff dialog */}
      <Dialog open={diffDialogOpen} onClose={() => setDiffDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>BIM model changes detected</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary">
            The uploaded BIM model differs from the current floor/room structure.
          </Typography>

          {structureDiff && structureDiff.newFloors.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="success.main">New floors ({structureDiff.newFloors.length})</Typography>
              {structureDiff.newFloors.map((f, i) => (
                <Typography key={i} variant="body2" sx={{ pl: 2 }}>
                  {f.name} — {f.roomCount} room{f.roomCount === 1 ? '' : 's'}
                </Typography>
              ))}
            </Box>
          )}

          {structureDiff && structureDiff.newRooms.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="success.main">New rooms ({structureDiff.newRooms.length})</Typography>
              {structureDiff.newRooms.map((r, i) => (
                <Typography key={i} variant="body2" sx={{ pl: 2 }}>
                  {r.number ? `${r.number} — ` : ''}{r.name} (on {r.floorName})
                </Typography>
              ))}
            </Box>
          )}

          {structureDiff && structureDiff.removedFloors.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="error.main">Removed floors ({structureDiff.removedFloors.length})</Typography>
              {structureDiff.removedFloors.map((f, i) => (
                <Typography key={i} variant="body2" sx={{ pl: 2 }}>
                  {f.name} — {f.roomCount} room{f.roomCount === 1 ? '' : 's'} (devices will be kept in the building)
                </Typography>
              ))}
            </Box>
          )}

          {structureDiff && structureDiff.removedRooms.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="error.main">Removed rooms ({structureDiff.removedRooms.length})</Typography>
              {structureDiff.removedRooms.map((r, i) => (
                <Typography key={i} variant="body2" sx={{ pl: 2 }}>
                  {r.name} (on {r.floorName}){r.deviceCount > 0 ? ` — ${r.deviceCount} device${r.deviceCount === 1 ? '' : 's'} will be unassigned` : ''}
                </Typography>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiffDialogOpen(false)}>
            Keep current structure
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={async () => {
              await applyBuildingStructureChanges(buildingId, ifcStructureRef.current, true, true);
              const floors = await getBuildingFloors(buildingId);
              setApiFloors(floors);
              setDiffDialogOpen(false);
              setStructureDiff(null);
            }}
          >
            Apply all changes
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default BimView;
