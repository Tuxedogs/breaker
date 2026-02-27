import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  MeshStandardMaterial,
  Plane,
  PerspectiveCamera,
  Vector3,
  type NormalBufferAttributes,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import CTM from "../../lib/openctm/ctm.js";

type CtmBody = {
  indices: Uint32Array;
  vertices: Float32Array;
  normals?: Float32Array;
  uvMaps?: Array<{ uv: Float32Array }>;
  attrMaps?: Array<{ name?: string; attr: Float32Array }>;
};

type CtmFile = {
  body: CtmBody;
};

type CtmModule = {
  Stream: new (data: Uint8Array) => unknown;
  File: new (stream: unknown) => CtmFile;
};

export type ShipMapViewState = {
  position: [number, number, number];
  target: [number, number, number];
};

type ShipMapTemplateProps = {
  title: string;
  subtitle: string;
  modelPath: string;
  viewStorageKey: string;
  fallbackView: ShipMapViewState;
  showHeader?: boolean;
  modelTransform?: {
    scale?: number;
    offset?: [number, number, number];
  };
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function readSavedView(storageKey: string, fallbackView: ShipMapViewState): ShipMapViewState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallbackView;
    const parsed = JSON.parse(raw) as Partial<ShipMapViewState>;
    const position = parsed.position;
    const target = parsed.target;
    if (
      !Array.isArray(position) ||
      position.length !== 3 ||
      !position.every((n) => typeof n === "number") ||
      !Array.isArray(target) ||
      target.length !== 3 ||
      !target.every((n) => typeof n === "number")
    ) {
      return fallbackView;
    }
    return {
      position: [position[0], position[1], position[2]],
      target: [target[0], target[1], target[2]],
    };
  } catch {
    return fallbackView;
  }
}

function createGeometryFromCtm(
  body: CtmBody,
  transform?: { scale?: number; offset?: [number, number, number] },
): { geometry: BufferGeometry<NormalBufferAttributes>; suggestedScale: number } {
  const geometry = new BufferGeometry();
  geometry.setIndex(new BufferAttribute(body.indices, 1));
  geometry.setAttribute("position", new BufferAttribute(body.vertices, 3));

  if (body.normals) {
    geometry.setAttribute("normal", new BufferAttribute(body.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  const uvMap = body.uvMaps?.[0];
  if (uvMap?.uv) {
    geometry.setAttribute("uv", new BufferAttribute(uvMap.uv, 2));
  }

  const colorMap = body.attrMaps?.find((map) => map.name === "Color");
  if (colorMap?.attr) {
    const colorArray = new Float32Array((colorMap.attr.length / 4) * 3);
    for (let i = 0, j = 0; i < colorMap.attr.length; i += 4) {
      colorArray[j++] = colorMap.attr[i];
      colorArray[j++] = colorMap.attr[i + 1];
      colorArray[j++] = colorMap.attr[i + 2];
    }
    geometry.setAttribute("color", new BufferAttribute(colorArray, 3));
  }

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox ?? new Box3();
  const size = new Vector3();
  const center = new Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  const offset = transform?.offset ?? [0, 0, 0];
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const suggestedScale = 5.4 / maxAxis;
  const scale = transform?.scale ?? suggestedScale;
  geometry.translate(offset[0], offset[1], offset[2]);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();

  return { geometry, suggestedScale };
}

function FitCtmMesh({
  geometry,
  clippingPlanes,
  sliceEnabled,
}: {
  geometry: BufferGeometry<NormalBufferAttributes>;
  clippingPlanes: Plane[];
  sliceEnabled: boolean;
}) {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#7693a1",
        emissive: "#17333d",
        metalness: 0.03,
        roughness: 0.9,
        vertexColors: geometry.getAttribute("color") !== undefined,
        clippingPlanes: sliceEnabled ? clippingPlanes : [],
        clipIntersection: false,
      }),
    [geometry, clippingPlanes, sliceEnabled],
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return <mesh geometry={geometry} material={material} />;
}

export default function ShipMapTemplate({
  title,
  subtitle,
  modelPath,
  viewStorageKey,
  fallbackView,
  showHeader = true,
  modelTransform,
}: ShipMapTemplateProps) {
  const initialView = useMemo(() => readSavedView(viewStorageKey, fallbackView), [viewStorageKey, fallbackView]);
  const [geometry, setGeometry] = useState<BufferGeometry<NormalBufferAttributes> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ShipMapViewState>(initialView);
  const [viewSaveStatus, setViewSaveStatus] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [suggestedScale, setSuggestedScale] = useState<number | null>(null);
  const [sliceEnabled, setSliceEnabled] = useState(false);
  const [deckBounds, setDeckBounds] = useState<{ min: number; max: number }>({ min: -1, max: 1 });
  const [deckMin, setDeckMin] = useState(-1);
  const [deckMax, setDeckMax] = useState(1);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const clippingPlanes = useMemo(
    () => [new Plane(new Vector3(0, 1, 0), -deckMin), new Plane(new Vector3(0, -1, 0), deckMax)],
    [deckMin, deckMax],
  );

  const topDownHeight = useMemo(() => {
    const span = Math.max(deckBounds.max - deckBounds.min, 1);
    return deckBounds.max + span * 1.2;
  }, [deckBounds]);

  function handleControlsChange() {
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object;
    setCurrentView({
      position: [round3(camera.position.x), round3(camera.position.y), round3(camera.position.z)],
      target: [round3(controls.target.x), round3(controls.target.y), round3(controls.target.z)],
    });
  }

  function saveCurrentViewAsDefault() {
    localStorage.setItem(viewStorageKey, JSON.stringify(currentView));
    setViewSaveStatus("Default view saved.");
  }

  function resetDefaultView() {
    localStorage.removeItem(viewStorageKey);
    setViewSaveStatus("Default view reset. Reload to apply.");
  }

  async function copyViewJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentView));
      setCopyStatus("View JSON copied.");
    } catch {
      setCopyStatus("Copy failed.");
    }
  }

  async function copySuggestedScale() {
    if (suggestedScale === null) return;
    try {
      await navigator.clipboard.writeText(`${suggestedScale}`);
      setCopyStatus("Suggested scale copied.");
    } catch {
      setCopyStatus("Copy failed.");
    }
  }

  function moveCameraTopDown() {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    camera.position.set(0, topDownHeight, 0.001);
    controls.target.set(0, 0, 0);
    controls.update();
    handleControlsChange();
  }

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shipSegment = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const minSegment = `${round3(deckMin)}`.replace(/[^\d.-]+/g, "_");
    const maxSegment = `${round3(deckMax)}`.replace(/[^\d.-]+/g, "_");
    const link = document.createElement("a");
    link.download = `${shipSegment || "ship"}-y${minSegment}_to_${maxSegment}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  useEffect(() => {
    if (!viewSaveStatus) return;
    const timeout = window.setTimeout(() => setViewSaveStatus(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [viewSaveStatus]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = window.setTimeout(() => setCopyStatus(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  useEffect(() => {
    let isCancelled = false;

    async function loadModel() {
      try {
        const response = await fetch(modelPath);
        if (!response.ok) {
          throw new Error(`Model request failed: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);
        const ctm = CTM as unknown as CtmModule;
        const stream = new ctm.Stream(data);
        const file = new ctm.File(stream);
        const parsed = createGeometryFromCtm(file.body, modelTransform);
        const parsedGeometry = parsed.geometry;
        if (isCancelled) {
          parsedGeometry.dispose();
          return;
        }

        setSuggestedScale(parsed.suggestedScale);
        const bounds = parsedGeometry.boundingBox ?? new Box3();
        const minY = bounds.min.y;
        const maxY = bounds.max.y;
        setDeckBounds({ min: minY, max: maxY });
        setDeckMin(minY);
        setDeckMax(maxY);
        setGeometry(parsedGeometry);
        setLoadError(null);
      } catch (error) {
        if (isCancelled) return;
        const message = error instanceof Error ? error.message : "Unknown CTM parsing error";
        setLoadError(message);
      }
    }

    void loadModel();

    return () => {
      isCancelled = true;
    };
  }, [modelPath, modelTransform]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  return (
    <section className="route-fade pb-8 pt-2">
      <div className="mx-auto w-full max-w-none space-y-6">
        {showHeader ? (
          <article className="framework-modern-card framework-modern-card-ships rounded-[1.9rem] border border-amber-300/35 bg-black/35 p-4 backdrop-blur sm:p-6">
            <header className="framework-modern-card-head rounded-[1.2rem] border border-white/15 p-5">
              <p className="framework-modern-kicker">Ship Maps</p>
              <h1 className="title-font mt-2 text-4xl tracking-[0.07em] text-amber-200 sm:text-5xl">{title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">{subtitle}</p>
            </header>
          </article>
        ) : null}

        <article className="framework-modern-card framework-modern-card-ships overflow-hidden rounded-[1.9rem] border border-amber-300/35 bg-black/35 p-2 backdrop-blur sm:p-3">
          <div className="relative h-[72vh] min-h-[620px] w-full rounded-[1.2rem] border border-white/15 bg-[radial-gradient(circle_at_50%_25%,rgba(24,67,86,0.65),rgba(5,10,18,0.95)_62%)]">
            <Canvas
              gl={{ localClippingEnabled: true, preserveDrawingBuffer: true }}
              camera={{ position: initialView.position, fov: 42 }}
              onCreated={({ gl, camera }) => {
                gl.localClippingEnabled = true;
                canvasRef.current = gl.domElement;
                cameraRef.current = camera as PerspectiveCamera;
              }}
            >
              <ambientLight intensity={0.67} />
              <directionalLight position={[6, 6, 5]} intensity={1.3} />
              <directionalLight position={[-5, -3, -4]} intensity={0.31} />
              <gridHelper args={[20, 20, "#2f6b80", "#143243"]} position={[0, -3.4, 0]} />
              {geometry ? (
                <FitCtmMesh geometry={geometry} clippingPlanes={clippingPlanes} sliceEnabled={sliceEnabled} />
              ) : null}
              <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.08}
                minDistance={2.6}
                maxDistance={20}
                target={initialView.target}
                onChange={handleControlsChange}
              />
            </Canvas>

            <div className="absolute right-4 top-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSliceEnabled((enabled) => !enabled)}
                className="rounded-md border border-white/35 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/65"
              >
                {sliceEnabled ? "Disable Slice" : "Enable Slice"}
              </button>
              <button
                type="button"
                onClick={moveCameraTopDown}
                className="rounded-md border border-white/35 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/65"
              >
                Top Down
              </button>
              <button
                type="button"
                onClick={exportPng}
                className="rounded-md border border-white/35 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/65"
              >
                Export PNG
              </button>
              <button
                type="button"
                onClick={copyViewJson}
                className="rounded-md border border-white/35 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/65"
              >
                Copy View JSON
              </button>
              <button
                type="button"
                onClick={copySuggestedScale}
                className="rounded-md border border-white/35 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={suggestedScale === null}
              >
                Copy Suggested Scale
              </button>
              <button
                type="button"
                onClick={saveCurrentViewAsDefault}
                className="rounded-md border border-amber-300/45 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-amber-100 transition hover:bg-black/65"
              >
                Save Current View
              </button>
              <button
                type="button"
                onClick={resetDefaultView}
                className="rounded-md border border-slate-300/35 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-slate-100 transition hover:bg-black/65"
              >
                Reset Default
              </button>
            </div>

            {sliceEnabled ? (
              <div className="absolute left-4 top-4 w-[min(320px,calc(100%-2rem))] rounded-md border border-white/20 bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
                <label className="block text-[11px] uppercase tracking-[0.14em] text-cyan-100">
                  deckMin: {round3(deckMin)}
                </label>
                <input
                  type="range"
                  min={deckBounds.min}
                  max={deckBounds.max}
                  step={0.001}
                  value={deckMin}
                  onChange={(event) => {
                    const nextMin = Number(event.target.value);
                    setDeckMin(Math.min(nextMin, deckMax));
                  }}
                  className="mt-1 h-5 w-full"
                />
                <label className="mt-2 block text-[11px] uppercase tracking-[0.14em] text-cyan-100">
                  deckMax: {round3(deckMax)}
                </label>
                <input
                  type="range"
                  min={deckBounds.min}
                  max={deckBounds.max}
                  step={0.001}
                  value={deckMax}
                  onChange={(event) => {
                    const nextMax = Number(event.target.value);
                    setDeckMax(Math.max(nextMax, deckMin));
                  }}
                  className="mt-1 h-5 w-full"
                />
              </div>
            ) : null}

            <div className="absolute bottom-4 left-4 rounded-md border border-white/20 bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
              <p>slice: {sliceEnabled ? "enabled" : "disabled"}</p>
              <p>deck: [{round3(deckMin)}, {round3(deckMax)}]</p>
              <p>suggestedScale: {suggestedScale === null ? "n/a" : round3(suggestedScale)}</p>
              <p>cam: [{currentView.position.join(", ")}]</p>
              <p>target: [{currentView.target.join(", ")}]</p>
              {viewSaveStatus ? <p className="mt-1 text-cyan-200">{viewSaveStatus}</p> : null}
              {copyStatus ? <p className="mt-1 text-cyan-200">{copyStatus}</p> : null}
            </div>

            {!geometry && !loadError ? (
              <p className="absolute inset-x-0 top-4 text-center text-xs uppercase tracking-[0.15em] text-cyan-200/85">
                Loading CTM model...
              </p>
            ) : null}

            {loadError ? (
              <p className="absolute inset-x-0 top-4 text-center text-xs uppercase tracking-[0.15em] text-red-300">
                Failed to load model: {loadError}
              </p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
