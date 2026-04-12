import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  ListSubheader,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import VerticalAlignTopRoundedIcon from '@mui/icons-material/VerticalAlignTopRounded';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as WebIFC from 'web-ifc';
import { getBuilding, getBuildingIfcUrl } from '../../api/api';

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
}

function BimView({ buildingId, onBack }: BimViewProps) {
  const ifcUrl = getBuildingIfcUrl(buildingId);
  const [buildingName, setBuildingName] = useState(buildingId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storeys, setStoreys] = useState<StoreyInfo[]>([]);
  const [activeStorey, setActiveStorey] = useState<number | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomInfo | null>(null);
  const prevRoomMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material>>(new Map());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const [ambientIntensity, setAmbientIntensity] = useState(0.25);
  const [shadowIntensity, setShadowIntensity] = useState(1.2);
  const initialCameraPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const initialTarget = useRef<THREE.Vector3>(new THREE.Vector3());

  // Fetch building name
  useEffect(() => {
    getBuilding(buildingId)
      .then((b) => setBuildingName(b.name))
      .catch(() => {});
  }, [buildingId]);

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

    // Top-down view centered on the room
    const maxDim = room.size ? Math.max(room.size.x, room.size.z) : 5;
    const distance = Math.max(maxDim * 2.5, 8);

    controls.target.copy(room.center);
    camera.position.set(room.center.x, room.center.y + distance, room.center.z + 0.01);
    camera.up.set(0, 0, -1);
    camera.lookAt(room.center);
    camera.updateProjectionMatrix();
    controls.update();
  };

  const topView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const target = controls.target.clone();
    camera.position.set(target.x, target.y + 50, target.z + 0.01);
    camera.up.set(0, 0, -1);
    camera.lookAt(target);
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

        {storeys.length > 0 && (
          <ButtonGroup size="small" variant="outlined">
            <Button
              variant={activeStorey === null ? 'contained' : 'outlined'}
              onClick={() => setActiveStorey(null)}
            >
              All floors
            </Button>
            {storeys.map((storey) => (
              <Button
                key={storey.id}
                variant={activeStorey === storey.id ? 'contained' : 'outlined'}
                onClick={() => setActiveStorey(storey.id)}
              >
                {storey.name}
              </Button>
            ))}
          </ButtonGroup>
        )}

        {rooms.length > 0 && (
          <TextField
            label="Room"
            select
            size="small"
            value={selectedRoom ? String(selectedRoom.expressId) : ''}
            onChange={(e) => {
              const room = rooms.find((r) => String(r.expressId) === e.target.value);
              if (room) navigateToRoom(room);
            }}
            sx={{ minWidth: 260 }}
            InputLabelProps={{ shrink: true }}
            SelectProps={{
              displayEmpty: true,
              renderValue: (v) => {
                if (!v) return 'Go to room...';
                const r = rooms.find((rm) => String(rm.expressId) === v);
                return r?.name ?? 'Go to room...';
              },
            }}
          >
            {storeys.map((storey) => {
              const storeyRooms = rooms.filter((r) => r.storeyId === storey.id);
              if (storeyRooms.length === 0) return null;
              return [
                <ListSubheader key={`header-${storey.id}`} sx={{ backgroundColor: 'rgba(15,23,42,0.95)', color: 'text.secondary', fontWeight: 700, fontSize: '0.75rem', lineHeight: '32px' }}>
                  {storey.name}
                </ListSubheader>,
                ...storeyRooms.map((room) => (
                  <MenuItem key={room.expressId} value={String(room.expressId)} disabled={!room.center} sx={{ pl: 4 }}>
                    {room.name}
                  </MenuItem>
                )),
              ];
            })}
            {(() => {
              const unassigned = rooms.filter((r) => r.storeyId === null);
              if (unassigned.length === 0) return null;
              return [
                <ListSubheader key="header-unassigned" sx={{ backgroundColor: 'rgba(15,23,42,0.95)', color: 'text.secondary', fontWeight: 700, fontSize: '0.75rem', lineHeight: '32px' }}>
                  Other
                </ListSubheader>,
                ...unassigned.map((room) => (
                  <MenuItem key={room.expressId} value={String(room.expressId)} disabled={!room.center} sx={{ pl: 4 }}>
                    {room.name}
                  </MenuItem>
                )),
              ];
            })()}
          </TextField>
        )}
      </Box>

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
            <Button size="small" variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={resetView} sx={{ fontSize: '0.7rem' }}>
              Reset
            </Button>
            <Button size="small" variant="outlined" startIcon={<VerticalAlignTopRoundedIcon />} onClick={topView} sx={{ fontSize: '0.7rem' }}>
              Top
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
    </Paper>
  );
}

export default BimView;
