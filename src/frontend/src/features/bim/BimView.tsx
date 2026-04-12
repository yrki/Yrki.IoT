import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as WebIFC from 'web-ifc';
import { getBuildingIfcUrl } from '../../api/api';

interface StoreyInfo {
  id: number;
  name: string;
  elevation: number;
  group: THREE.Group;
}

interface BimViewProps {
  buildingId: string;
  buildingName: string;
  onBack: () => void;
}

function BimView({ buildingId, buildingName, onBack }: BimViewProps) {
  const ifcUrl = getBuildingIfcUrl(buildingId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storeys, setStoreys] = useState<StoreyInfo[]>([]);
  const [activeStorey, setActiveStorey] = useState<number | null>(null); // null = all

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
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 5, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 50, 50);
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.4));
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

        // --- Build geometry ---
        setProgress('Building geometry...');
        const meshMaterials = new Map<string, THREE.MeshLambertMaterial>();

        ifcApi.StreamAllMeshes(modelID, (mesh: WebIFC.FlatMesh) => {
          const placedGeometries = mesh.geometries;

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

            const color = pg.color;
            const colorKey = `${color.x.toFixed(3)}_${color.y.toFixed(3)}_${color.z.toFixed(3)}_${color.w.toFixed(3)}`;
            let material = meshMaterials.get(colorKey);
            if (!material) {
              material = new THREE.MeshLambertMaterial({
                color: new THREE.Color(color.x, color.y, color.z),
                transparent: color.w < 1,
                opacity: color.w,
                side: THREE.DoubleSide,
              });
              meshMaterials.set(colorKey, material);
            }

            const threeMesh = new THREE.Mesh(geometry, material);
            const matrix = new THREE.Matrix4();
            matrix.fromArray(pg.flatTransformation);
            threeMesh.applyMatrix4(matrix);

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
        }

        setStoreys(storeyGroups.map((sg) => ({
          id: sg.id,
          name: sg.name,
          elevation: sg.elevation,
          group: sg.group,
        })));
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
        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{buildingName}</Typography>
          <Typography variant="caption" color="text.secondary">
            Zoom: scroll · Rotate: left-click · Pan: right-click
          </Typography>
        </Box>

        {storeys.length > 0 && (
          <>
            <Box sx={{ flexGrow: 1 }} />
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
          </>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
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
