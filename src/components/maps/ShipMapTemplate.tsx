import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  MeshStandardMaterial,
  PerspectiveCamera,
  RepeatWrapping,
  SRGBColorSpace,
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

type ShipMapDeckOverlay = {
  title: string;
  id: string;
  deckMin: number;
  deckMax: number;
  svgPath: string;
  viewBox: [number, number];
  rotationDeg?: number;
  offsetX?: number;
  offsetZ?: number;
  scaleMultiplier?: number;
};

type ShipMapDeckOverlayConfig = {
  decks: ShipMapDeckOverlay[];
};

type DeckOverlayRegion = {
  key: string;
  label: string;
  centerX: number;
  centerY: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  highlightMarkup: string;
};

const SHIP_SILVER_COLOR = "#f8f8f8";
const HULL_OPACITY_WITH_FLOORS = 0.12;
const HULL_OPACITY_WITHOUT_FLOORS = 1;

type ShipMapTemplateProps = {
  title: string;
  subtitle: string;
  modelPath: string;
  viewStorageKey: string;
  fallbackView: ShipMapViewState;
  showHeader?: boolean;
  deckOverlayConfig?: ShipMapDeckOverlayConfig;
  modelTransform?: {
    scale?: number;
    offset?: [number, number, number];
  };
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveDeckPlaneSize(
  deck: Pick<ShipMapDeckOverlay, "viewBox" | "scaleMultiplier">,
  modelSize: { x: number; z: number },
): [number, number] {
  const maxWidth = modelSize.x * 1.12;
  const maxDepth = modelSize.z * 1.12;
  const aspect = deck.viewBox[0] / Math.max(deck.viewBox[1], 1);

  let width = maxWidth;
  let depth = width / Math.max(aspect, 0.0001);
  if (depth > maxDepth) {
    depth = maxDepth;
    width = depth * aspect;
  }
  const scaleMultiplier = deck.scaleMultiplier ?? 1;
  return [width * scaleMultiplier, depth * scaleMultiplier];
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createHullPanelTexture(): CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.wrapS = RepeatWrapping;
    fallback.wrapT = RepeatWrapping;
    fallback.repeat.set(6, 6);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  const random = createSeededRandom(1337);
  ctx.fillStyle = "#b4b4b4";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 220; i += 1) {
    const x = Math.floor(random() * size);
    const y = Math.floor(random() * size);
    const w = 48 + Math.floor(random() * 192);
    const h = 24 + Math.floor(random() * 120);
    const tone = 130 + Math.floor(random() * 38);
    ctx.fillStyle = `rgb(${tone}, ${tone + 6}, ${tone + 14})`;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, Math.max(w - 2, 2), Math.max(h - 2, 2));
  }

  for (let i = 0; i < 360; i += 1) {
    const x1 = Math.floor(random() * size);
    const y1 = Math.floor(random() * size);
    const x2 = x1 + (random() > 0.5 ? 1 : -1) * (12 + Math.floor(random() * 96));
    const y2 = y1 + (random() > 0.5 ? 1 : -1) * (12 + Math.floor(random() * 96));
    ctx.strokeStyle = "rgba(55, 62, 72, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.floor((random() - 0.5) * 22);
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function labelizeRegion(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseDeckOverlayRegions(svgText: string): {
  regions: DeckOverlayRegion[];
  sourceViewBox: string | null;
} {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(svgText, "image/svg+xml");
  const svgRoot = parsed.querySelector("svg");
  if (!svgRoot) {
    return { regions: [], sourceViewBox: null };
  }

  const sourceViewBox = svgRoot.getAttribute("viewBox")?.trim() ?? null;
  const graphics = Array.from(svgRoot.querySelectorAll("path, polygon, rect, circle, ellipse"));
  if (graphics.length === 0) {
    return { regions: [], sourceViewBox };
  }

  const measureSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  if (sourceViewBox) {
    measureSvg.setAttribute("viewBox", sourceViewBox);
  }
  measureSvg.setAttribute("width", "1");
  measureSvg.setAttribute("height", "1");
  measureSvg.style.position = "absolute";
  measureSvg.style.left = "-99999px";
  measureSvg.style.top = "-99999px";
  measureSvg.style.pointerEvents = "none";
  measureSvg.style.opacity = "0";
  document.body.appendChild(measureSvg);

  const serializer = new XMLSerializer();
  const regions: DeckOverlayRegion[] = [];

  for (let index = 0; index < graphics.length; index += 1) {
    const sourceElement = graphics[index];
    const measureElement = sourceElement.cloneNode(true) as SVGGraphicsElement;
    measureSvg.appendChild(measureElement);

    let bbox: DOMRect;
    try {
      bbox = measureElement.getBBox();
    } catch {
      measureSvg.removeChild(measureElement);
      continue;
    }
    measureSvg.removeChild(measureElement);

    const idCandidate = sourceElement.getAttribute("id")?.trim();
    const nameCandidate =
      sourceElement.getAttribute("data-name")?.trim() ??
      sourceElement.getAttribute("aria-label")?.trim() ??
      sourceElement.getAttribute("inkscape:label")?.trim();
    const rawLabel = nameCandidate || idCandidate || `section_${index + 1}`;
    const label = labelizeRegion(rawLabel) || `Section ${index + 1}`;
    const stableKey = `${idCandidate || "section"}-${index}`;

    const highlightElement = sourceElement.cloneNode(true) as Element;
    highlightElement.removeAttribute("style");
    highlightElement.setAttribute("fill", "#67e8f9");
    highlightElement.setAttribute("fill-opacity", "0.48");
    highlightElement.setAttribute("stroke", "#a5f3fc");
    highlightElement.setAttribute("stroke-width", "4");
    highlightElement.setAttribute("stroke-linejoin", "round");
    highlightElement.setAttribute("stroke-linecap", "round");

    regions.push({
      key: stableKey,
      label,
      centerX: round3(bbox.x + bbox.width / 2),
      centerY: round3(bbox.y + bbox.height / 2),
      bounds: {
        x: round3(bbox.x),
        y: round3(bbox.y),
        width: round3(bbox.width),
        height: round3(bbox.height),
      },
      highlightMarkup: serializer.serializeToString(highlightElement),
    });
  }

  document.body.removeChild(measureSvg);
  return { regions, sourceViewBox };
}

function buildHighlightTextureDataUri(viewBox: string, highlightMarkup: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${highlightMarkup}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
  opacity,
}: {
  geometry: BufferGeometry<NormalBufferAttributes>;
  opacity: number;
}) {
  const hasUv = geometry.getAttribute("uv") !== undefined;
  const hasVertexColor = geometry.getAttribute("color") !== undefined;
  const panelTexture = useMemo(() => (hasUv ? createHullPanelTexture() : null), [hasUv]);

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: SHIP_SILVER_COLOR,
        emissive: "#1a2028",
        emissiveIntensity: 0.1,
        metalness: 0,
        roughness: 1,
        map: panelTexture ?? undefined,
        bumpMap: panelTexture ?? undefined,
        bumpScale: panelTexture ? 0.018 : 0,
        vertexColors: !panelTexture && hasVertexColor,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
      }),
    [panelTexture, hasVertexColor, opacity],
  );

  useEffect(() => {
    return () => {
      material.dispose();
      panelTexture?.dispose();
    };
  }, [material, panelTexture]);

  return <mesh geometry={geometry} material={material} />;
}

function DeckOverlayPlane({
  deck,
  modelSize,
  texturePath,
  opacity,
  renderOrder,
  yOffset = 0.002,
}: {
  deck: ShipMapDeckOverlay;
  modelSize: { x: number; z: number };
  texturePath: string;
  opacity: number;
  renderOrder: number;
  yOffset?: number;
}) {
  const texture = useTexture(texturePath);

  const [planeWidth, planeDepth] = useMemo(
    () => resolveDeckPlaneSize(deck, modelSize),
    [deck, modelSize],
  );

  const y = deck.deckMin + yOffset;
  const rotationInPlane = -(((deck.rotationDeg ?? 0) * Math.PI) / 180);
  const offsetX = deck.offsetX ?? 0;
  const offsetZ = deck.offsetZ ?? 0;

  return (
    <group position={[offsetX, y, offsetZ]} rotation={[-Math.PI / 2, 0, rotationInPlane]}>
      <mesh renderOrder={renderOrder}>
        <planeGeometry args={[planeWidth, planeDepth]} />
        <meshBasicMaterial
          map={texture}
          side={DoubleSide}
          transparent
          opacity={opacity}
          depthTest
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export default function ShipMapTemplate({
  title,
  subtitle,
  modelPath,
  viewStorageKey,
  fallbackView,
  showHeader = true,
  deckOverlayConfig,
  modelTransform,
}: ShipMapTemplateProps) {
  const hasDeckOverlay = Boolean(deckOverlayConfig?.decks.length);
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
  const [deckOverlayEnabled, setDeckOverlayEnabled] = useState(false);
  const [activeDeckOverlayId, setActiveDeckOverlayId] = useState(
    deckOverlayConfig?.decks[0]?.id ?? ""
  );
  const [modelFootprint, setModelFootprint] = useState<{ x: number; z: number }>({ x: 1, z: 1 });
  const [deckOverlayRegions, setDeckOverlayRegions] = useState<DeckOverlayRegion[]>([]);
  const [deckOverlayViewBox, setDeckOverlayViewBox] = useState<string | null>(null);
  const [deckOverlayRegionsLoading, setDeckOverlayRegionsLoading] = useState(false);
  const [deckOverlayRegionsError, setDeckOverlayRegionsError] = useState<string | null>(null);
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);
  const [hoveredRegionKey, setHoveredRegionKey] = useState<string | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const topDownHeight = useMemo(() => {
    const span = Math.max(deckBounds.max - deckBounds.min, 1);
    return deckBounds.max + span * 1.2;
  }, [deckBounds]);

  const activeDeckOverlay = useMemo(
    () => deckOverlayConfig?.decks.find((deck) => deck.id === activeDeckOverlayId) ?? null,
    [deckOverlayConfig, activeDeckOverlayId],
  );
  const hullOpacity = deckOverlayEnabled ? HULL_OPACITY_WITH_FLOORS : HULL_OPACITY_WITHOUT_FLOORS;
  const activeRegionKey = hoveredRegionKey ?? selectedRegionKey;
  const activeDeckRegion = useMemo(
    () => deckOverlayRegions.find((region) => region.key === activeRegionKey) ?? null,
    [deckOverlayRegions, activeRegionKey],
  );
  const activeDeckRegionHighlightUri = useMemo(() => {
    if (!activeDeckRegion) return null;
    const fallbackViewBox = activeDeckOverlay
      ? `0 0 ${activeDeckOverlay.viewBox[0]} ${activeDeckOverlay.viewBox[1]}`
      : null;
    const viewBox = deckOverlayViewBox ?? fallbackViewBox;
    if (!viewBox) return null;
    return buildHighlightTextureDataUri(viewBox, activeDeckRegion.highlightMarkup);
  }, [activeDeckRegion, deckOverlayViewBox, activeDeckOverlay]);

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
        const size = new Vector3();
        bounds.getSize(size);
        setDeckBounds({ min: minY, max: maxY });
        setDeckMin(minY);
        setDeckMax(maxY);
        setModelFootprint({ x: Math.max(size.x, 0.1), z: Math.max(size.z, 0.1) });
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

  useEffect(() => {
    if (!hasDeckOverlay || !activeDeckOverlay) return;

    if (!deckOverlayEnabled) {
      setSliceEnabled(false);
      setDeckMin(deckBounds.min);
      setDeckMax(deckBounds.max);
      return;
    }

    const clearance = 0.02;
    const targetMin = deckBounds.min;
    const rawMax = Math.min(deckBounds.max, activeDeckOverlay.deckMin + clearance);
    const targetMax = Math.max(rawMax, targetMin + 0.005);

    setSliceEnabled(true);
    setDeckMin(targetMin);
    setDeckMax(targetMax);
  }, [hasDeckOverlay, activeDeckOverlay, deckOverlayEnabled, deckBounds.min, deckBounds.max]);

  useEffect(() => {
    let cancelled = false;

    setDeckOverlayRegions([]);
    setDeckOverlayViewBox(null);
    setDeckOverlayRegionsError(null);
    setSelectedRegionKey(null);
    setHoveredRegionKey(null);

    if (!activeDeckOverlay) return;
    const overlay = activeDeckOverlay;

    async function loadDeckRegions() {
      try {
        setDeckOverlayRegionsLoading(true);
        const response = await fetch(overlay.svgPath);
        if (!response.ok) {
          throw new Error(`SVG request failed: ${response.status}`);
        }
        const svgText = await response.text();
        if (cancelled) return;
        const parsed = parseDeckOverlayRegions(svgText);
        setDeckOverlayRegions(parsed.regions);
        setDeckOverlayViewBox(parsed.sourceViewBox);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Region parsing failed";
        setDeckOverlayRegionsError(message);
      } finally {
        if (!cancelled) {
          setDeckOverlayRegionsLoading(false);
        }
      }
    }

    void loadDeckRegions();

    return () => {
      cancelled = true;
    };
  }, [activeDeckOverlay]);

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
              <ambientLight intensity={0.44} />
              <directionalLight position={[6, 6, 5]} intensity={0.85} />
              <directionalLight position={[-5, -3, -4]} intensity={0.2} />
              <gridHelper args={[20, 20, "#a7acad", "#143243"]} position={[0, -3.4, 0]} />
              {geometry ? (
                <FitCtmMesh geometry={geometry} opacity={hullOpacity} />
              ) : null}
              {deckOverlayEnabled && activeDeckOverlay && geometry ? (
                <DeckOverlayPlane
                  deck={activeDeckOverlay}
                  modelSize={modelFootprint}
                  texturePath={activeDeckOverlay.svgPath}
                  opacity={0.95}
                  renderOrder={41}
                />
              ) : null}
              {deckOverlayEnabled && activeDeckOverlay && activeDeckRegionHighlightUri && geometry ? (
                <DeckOverlayPlane
                  deck={activeDeckOverlay}
                  modelSize={modelFootprint}
                  texturePath={activeDeckRegionHighlightUri}
                  opacity={0.98}
                  renderOrder={42}
                  yOffset={0.0035}
                />
              ) : null}
              <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.08}
                minDistance={0}
                maxDistance={20}
                target={initialView.target}
                onChange={handleControlsChange}
              />
            </Canvas>

            <div className="absolute right-4 top-4 flex flex-col gap-2">
              {hasDeckOverlay ? (
                <button
                  type="button"
                  onClick={() => setDeckOverlayEnabled((enabled) => !enabled)}
                  className="rounded-md border border-white/35 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/65"
                >
                  {deckOverlayEnabled ? "Exterior" : "Interior"}
                </button>
              ) : null}
              {hasDeckOverlay && deckOverlayConfig ? (
                <div className="flex flex-wrap justify-end gap-2 rounded-md border border-white/20 bg-black/55 p-2">
                  {deckOverlayConfig.decks.map((deck) => {
                    const isActive = deck.id === activeDeckOverlayId;
                    return (
                      <button
                        key={deck.id}
                        type="button"
                        onClick={() => {
                          setActiveDeckOverlayId(deck.id);
                          setDeckOverlayEnabled(true);
                        }}
                        className={`rounded-md border px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition ${
                          isActive
                            ? "border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
                            : "border-white/30 bg-black/45 text-slate-100 hover:bg-black/65"
                        }`}
                        aria-pressed={isActive}
                      >
                        {deck.title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {sliceEnabled && !hasDeckOverlay ? (
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

            <div className="absolute bottom-4 left-4 flex w-[min(360px,calc(100%-2rem))] flex-col gap-2">
              <p className="rounded-md border border-white/20 bg-black/55 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-cyan-100">
                Dev purpose only controls
              </p>
              <div className="rounded-md border border-white/20 bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
                <p>slice: {sliceEnabled ? "enabled" : "disabled"}</p>
                <p>deck: [{round3(deckMin)}, {round3(deckMax)}]</p>
                {activeDeckOverlay ? <p>active floor: {activeDeckOverlay.title}</p> : null}
                <p>suggestedScale: {suggestedScale === null ? "n/a" : round3(suggestedScale)}</p>
                <p>cam: [{currentView.position.join(", ")}]</p>
                <p>target: [{currentView.target.join(", ")}]</p>
                {viewSaveStatus ? <p className="mt-1 text-cyan-200">{viewSaveStatus}</p> : null}
                {copyStatus ? <p className="mt-1 text-cyan-200">{copyStatus}</p> : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2 rounded-md border border-white/20 bg-black/55 p-2">
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

              {hasDeckOverlay ? (
                <div className="rounded-md border border-white/20 bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-100">Floor Section Legend</p>
                  {deckOverlayRegionsLoading ? <p className="mt-1">Loading sections...</p> : null}
                  {deckOverlayRegionsError ? <p className="mt-1 text-red-200">section parse failed: {deckOverlayRegionsError}</p> : null}
                  {!deckOverlayRegionsLoading && !deckOverlayRegionsError ? (
                    <>
                      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                        {deckOverlayRegions.map((region) => {
                          const isActive = region.key === activeRegionKey;
                          return (
                            <button
                              key={region.key}
                              type="button"
                              onClick={() => setSelectedRegionKey(region.key)}
                              onMouseEnter={() => setHoveredRegionKey(region.key)}
                              onMouseLeave={() => setHoveredRegionKey(null)}
                              onFocus={() => setHoveredRegionKey(region.key)}
                              onBlur={() => setHoveredRegionKey(null)}
                              className={`min-h-11 w-full rounded-md border px-2 py-1 text-left text-[11px] transition ${
                                isActive
                                  ? "border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
                                  : "border-white/25 bg-black/35 text-slate-100 hover:bg-black/55"
                              }`}
                              aria-pressed={region.key === selectedRegionKey}
                            >
                              {region.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 border-t border-white/10 pt-2">
                        coords:{" "}
                        {activeDeckRegion ? `[${activeDeckRegion.centerX}, ${activeDeckRegion.centerY}]` : "none"}
                      </p>
                      {activeDeckRegion ? (
                        <p>
                          bounds: [{activeDeckRegion.bounds.x}, {activeDeckRegion.bounds.y}, {activeDeckRegion.bounds.width},{" "}
                          {activeDeckRegion.bounds.height}]
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
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
