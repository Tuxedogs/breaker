import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, Text, useTexture } from "@react-three/drei";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  FrontSide,
  Group,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Plane,
  PerspectiveCamera,
  Raycaster,
  Vector3,
  Vector2,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import CTM from "../../lib/openctm/ctm.js";
import {
  ArmoryIcon,
  CoolerIcon,
  CrewQuartersIcon,
  ElevatorIcon,
  EngineeringTerminalIcon,
  LadderIcon,
  LifeSupportIcon,
  PowerPlantIcon,
  QuantumDriveIcon,
  RadarIcon,
  ShieldGeneratorIcon,
  TorpedoStationIcon,
  TurretStationIcon,
} from "../icons/DeckMarkerIcons";

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
  svgPath?: string;
  annotations?: ShipMapDeckAnnotationConfig;
  viewBox: [number, number];
  rotationDeg?: number;
  offsetX?: number;
  offsetZ?: number;
  scaleMultiplier?: number;
  widthMultiplier?: number;
  heightMultiplier?: number;
};

type ShipMapDeckAnnotationKind =
  | "Main Turret"
  | "Terminal"
  | "Power"
  | "Shield"
  | "Cooler"
  | "Radar"
  | "Quantum"
  | "Life-Support"
  | "Ladder"
  | "Elevator"
  | "Cargo";

type ShipMapDeckAnnotationPathing = {
  connectsDeckIds: Array<"bottom" | "mid" | "top">;
  toLabels?: string[];
};

type ShipMapDeckAnnotationBase = {
  id: string;
  label: string;
  token?: string;
  kind: ShipMapDeckAnnotationKind;
  worldPosition: [number, number, number];
  screenOffset?: [number, number];
  colorHint?: string;
  pathing?: ShipMapDeckAnnotationPathing;
};

type ShipMapDeckComponentAnnotation = ShipMapDeckAnnotationBase & {
  annotationType: "component";
};

type ShipMapDeckLabelAnnotation = ShipMapDeckAnnotationBase & {
  annotationType: "label";
};

type ShipMapDeckAnnotationConfig = {
  fixedHeightAboveDeckMin: number;
  worldOffset?: [number, number, number];
  components: ShipMapDeckComponentAnnotation[];
  labels: ShipMapDeckLabelAnnotation[];
};

type DeckMarkerIconComponent = (props: { className?: string }) => React.JSX.Element;
type LegendItemKey =
  | "power"
  | "radar"
  | "shield"
  | "quantum"
  | "cooler"
  | "crew-quarters"
  | "main-turret"
  | "torpedo-terminal"
  | "engineer-terminal"
  | "elevators"
  | "ladders"
  | "armory";
type ScreenPoint = { x: number; y: number };
type ScreenPath = { points: ScreenPoint[]; color: string };
type DeckMarkerTraceState = {
  key: string;
  annotationIds: readonly string[];
  color: string;
  startAnnotationId?: string;
};
type SelectedAnnotationTrace = {
  id: string;
  label: string;
  color: string;
};
type DeckMarkerLegendItem = {
  key: LegendItemKey;
  label: string;
  color: string;
  Icon: DeckMarkerIconComponent;
  annotationIds: readonly string[];
};
type DeckMarkerLegendSection = {
  title: string;
  items: readonly DeckMarkerLegendItem[];
};

const DECK_MARKER_LEGEND: readonly DeckMarkerLegendSection[] = [
  {
    title: "Ship Components",
    items: [
      { key: "power", label: "Power Plants", color: "#f59e0b", Icon: PowerPlantIcon, annotationIds: ["power-plant-1", "power-plant-2"] },
      { key: "shield", label: "Shield Generators", color: "#06a7bd", Icon: ShieldGeneratorIcon, annotationIds: ["shield-generator-1", "shield-generator-2"] },
      { key: "quantum", label: "Quantum Drive", color: "#911696", Icon: QuantumDriveIcon, annotationIds: ["qt-drive"] },
      { key: "radar", label: "Radar", color: "#1ed10e", Icon: RadarIcon, annotationIds: ["radar"] },
      { key: "cooler", label: "Coolers", color: "#93c5fd", Icon: CoolerIcon, annotationIds: ["cooler-1", "cooler-2"] },
      { key: "crew-quarters", label: "Crew Quarters", color: "#e2e8f0", Icon: CrewQuartersIcon, annotationIds: ["crew-quarters-section"] },
    ],
  },
  {
    title: "Crew Stations",
    items: [
      { key: "main-turret", label: "Main Turret", color: "#f50b0b", Icon: TurretStationIcon, annotationIds: ["gun-01"] },
      { key: "torpedo-terminal", label: "Torpedo Terminal", color: "#f50b0b", Icon: TorpedoStationIcon, annotationIds: ["torpedo-operator-terminal"] },
      { key: "engineer-terminal", label: "Engineer Terminals", color: "#67a1f9", Icon: EngineeringTerminalIcon, annotationIds: ["engineer-terminal-1", "engineer-terminal-2"] },
    ],
  },
  {
    title: "Navigation",
    items: [
      { key: "elevators", label: "Elevator", color: "#01ffd5", Icon: ElevatorIcon, annotationIds: ["elevator"] },
      { key: "ladders", label: "Ladders", color: "#01ffd5", Icon: LadderIcon, annotationIds: ["main-ladder", "secondary-ladder-port", "secondary-ladder-starboard"] },
      { key: "armory", label: "Armory", color: "#fca5a5", Icon: ArmoryIcon, annotationIds: ["armory-section"] },
    ],
  },
];

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

type ShipMapTemplateProps = {
  title: string;
  subtitle: string;
  modelPath: string;
  viewStorageKey: string;
  fallbackView: ShipMapViewState;
  showHeader?: boolean;
  deckOverlayConfig?: ShipMapDeckOverlayConfig;
  mergeMeshesForPerformance?: boolean;
  modelTransform?: {
    scale?: number;
    offset?: [number, number, number];
    rotation?: [number, number, number];
  };
};

type ModelSource = "gltf" | "obj" | "ctm";

type ResolvedModelTransform = {
  scale: number;
  offset: [number, number, number];
  rotation: [number, number, number];
};

type LoadedModelAsset = {
  source: ModelSource;
  scene: Object3D;
  baseBounds: Box3;
  suggestedScale: number;
};

type CachedModelAssetEntry = {
  refs: number;
  promise: Promise<LoadedModelAsset>;
  asset: LoadedModelAsset | null;
};

const MODEL_ASSET_CACHE = new Map<string, CachedModelAssetEntry>();
const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveDeckPlaneSize(
  deck: Pick<ShipMapDeckOverlay, "viewBox" | "scaleMultiplier"> & {
    widthMultiplier?: number;
    heightMultiplier?: number;
  },
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
  const widthMultiplier = deck.widthMultiplier ?? 1;
  const heightMultiplier = deck.heightMultiplier ?? 1;
  return [width * scaleMultiplier * widthMultiplier, depth * scaleMultiplier * heightMultiplier];
}

type ShipMapDeckOverlayConfig = {
  decks: ShipMapDeckOverlay[];
};

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

function buildDeckShadowTextureDataUri(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <radialGradient id="deck-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.55)" />
          <stop offset="62%" stop-color="rgba(0,0,0,0.24)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#deck-shadow)" />
    </svg>
  `;
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

function resolveModelSource(modelPath: string): ModelSource {
  const normalizedPath = modelPath.split("?")[0].trim().toLowerCase();
  if (normalizedPath.endsWith(".obj")) return "obj";
  if (normalizedPath.endsWith(".ctm")) return "ctm";
  return "gltf";
}

function computeSuggestedScale(bounds: Box3): number {
  const size = new Vector3();
  bounds.getSize(size);
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  return 5.4 / maxAxis;
}

function ensureFiniteBounds(bounds: Box3): Box3 {
  if (
    bounds.isEmpty() ||
    !Number.isFinite(bounds.min.x) ||
    !Number.isFinite(bounds.min.y) ||
    !Number.isFinite(bounds.min.z) ||
    !Number.isFinite(bounds.max.x) ||
    !Number.isFinite(bounds.max.y) ||
    !Number.isFinite(bounds.max.z)
  ) {
    return new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
  }
  return bounds;
}

function getSceneBounds(scene: Object3D): Box3 {
  scene.updateWorldMatrix(true, true);
  const measuredBounds = new Box3().setFromObject(scene);
  return ensureFiniteBounds(measuredBounds);
}

function disposeMaterial(material: Material) {
  for (const value of Object.values(material)) {
    if (value && typeof value === "object" && "isTexture" in value && value.isTexture) {
      value.dispose();
    }
  }
  material.dispose();
}

function disposeObject3dResources(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();

  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (node.geometry) {
      geometries.add(node.geometry);
    }
    if (Array.isArray(node.material)) {
      for (const material of node.material) {
        if (material) {
          materials.add(material);
        }
      }
      return;
    }
    if (node.material) {
      materials.add(node.material);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => disposeMaterial(material));
}

function createGeometryFromCtm(body: CtmBody): BufferGeometry {
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
  const center = new Vector3();
  bounds.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeBoundingBox();
  return geometry;
}

async function loadCtmModelAsset(modelPath: string): Promise<LoadedModelAsset> {
  const response = await fetch(modelPath);
  if (!response.ok) {
    throw new Error(`Model request failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const data = new Uint8Array(buffer);
  const ctm = CTM as unknown as CtmModule;
  const stream = new ctm.Stream(data);
  const file = new ctm.File(stream);
  const geometry = createGeometryFromCtm(file.body);
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  const scene = new Group();
  scene.add(mesh);
  const baseBounds = getSceneBounds(scene);
  return {
    source: "ctm",
    scene,
    baseBounds,
    suggestedScale: computeSuggestedScale(baseBounds),
  };
}

function getGltfRoot(gltf: GLTF): Object3D {
  if (gltf.scene) {
    return gltf.scene;
  }
  if (gltf.scenes[0]) {
    return gltf.scenes[0];
  }
  throw new Error("GLTF did not include a scene root.");
}

async function loadModelAsset(modelPath: string): Promise<LoadedModelAsset> {
  const source = resolveModelSource(modelPath);

  if (source === "gltf") {
    const gltf = await gltfLoader.loadAsync(modelPath);
    const scene = getGltfRoot(gltf);
    const baseBounds = getSceneBounds(scene);
    return {
      source,
      scene,
      baseBounds,
      suggestedScale: computeSuggestedScale(baseBounds),
    };
  }

  if (source === "obj") {
    const scene = await objLoader.loadAsync(modelPath);
    const baseBounds = getSceneBounds(scene);
    return {
      source,
      scene,
      baseBounds,
      suggestedScale: computeSuggestedScale(baseBounds),
    };
  }

  return loadCtmModelAsset(modelPath);
}

async function acquireModelAsset(modelPath: string): Promise<LoadedModelAsset> {
  let cacheEntry = MODEL_ASSET_CACHE.get(modelPath);

  if (!cacheEntry) {
    // Cache loaded source assets and release GPU resources when last consumer unmounts.
    const newEntry: CachedModelAssetEntry = {
      refs: 0,
      asset: null,
      promise: null as unknown as Promise<LoadedModelAsset>,
    };
    newEntry.promise = loadModelAsset(modelPath).then((asset) => {
      newEntry.asset = asset;
      if (newEntry.refs <= 0) {
        disposeObject3dResources(asset.scene);
        MODEL_ASSET_CACHE.delete(modelPath);
      }
      return asset;
    }).catch((error) => {
      MODEL_ASSET_CACHE.delete(modelPath);
      throw error;
    });
    MODEL_ASSET_CACHE.set(modelPath, newEntry);
    cacheEntry = newEntry;
  }

  cacheEntry.refs += 1;
  return cacheEntry.promise;
}

function releaseModelAsset(modelPath: string) {
  const cacheEntry = MODEL_ASSET_CACHE.get(modelPath);
  if (!cacheEntry) return;

  cacheEntry.refs -= 1;
  if (cacheEntry.refs > 0) return;
  if (!cacheEntry.asset) return;

  disposeObject3dResources(cacheEntry.asset.scene);
  MODEL_ASSET_CACHE.delete(modelPath);
}

function createMergedMeshScene(modelScene: Object3D): Object3D {
  const clonedGeometries: BufferGeometry[] = [];
  const worldMatrix = new Matrix4();

  modelScene.updateWorldMatrix(true, true);
  modelScene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (!node.geometry) return;
    const clonedGeometry = node.geometry.clone();
    worldMatrix.copy(node.matrixWorld);
    clonedGeometry.applyMatrix4(worldMatrix);
    clonedGeometries.push(clonedGeometry);
  });

  if (clonedGeometries.length === 0) {
    return modelScene;
  }

  const mergedGeometry = mergeGeometries(clonedGeometries, false);
  clonedGeometries.forEach((geometry) => geometry.dispose());

  if (!mergedGeometry) {
    return modelScene;
  }

  const mergedMesh = new Mesh(mergedGeometry, new MeshStandardMaterial());
  const mergedScene = new Group();
  mergedScene.add(mergedMesh);
  mergedScene.userData.__ownedGeometries = [mergedGeometry];
  mergedScene.userData.__ownedMaterials = [mergedMesh.material];
  return mergedScene;
}

function cloneSceneMeshResources(modelScene: Object3D): {
  ownedGeometries: BufferGeometry[];
  ownedMaterials: Material[];
} {
  const ownedGeometries: BufferGeometry[] = [];
  const ownedMaterials: Material[] = [];
  modelScene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (!node.geometry) return;
    const ownedGeometry = node.geometry.clone();
    node.geometry = ownedGeometry;
    ownedGeometries.push(ownedGeometry);
    if (Array.isArray(node.material)) {
      node.material = node.material.map((material) => {
        const ownedMaterial = material.clone();
        ownedMaterials.push(ownedMaterial);
        return ownedMaterial;
      });
      return;
    }
    const ownedMaterial = node.material.clone();
    node.material = ownedMaterial;
    ownedMaterials.push(ownedMaterial);
  });
  return { ownedGeometries, ownedMaterials };
}

function createModelSceneInstance(asset: LoadedModelAsset, mergeMeshesForPerformance: boolean): Object3D {
  const clonedScene = asset.scene.clone(true);
  if (!mergeMeshesForPerformance) {
    const { ownedGeometries, ownedMaterials } = cloneSceneMeshResources(clonedScene);
    clonedScene.userData.__ownedGeometries = ownedGeometries;
    clonedScene.userData.__ownedMaterials = ownedMaterials;
    return clonedScene;
  }
  return createMergedMeshScene(clonedScene);
}

function cloneModelSceneForPass(modelScene: Object3D): Object3D {
  const clonedScene = modelScene.clone(true);
  const { ownedGeometries, ownedMaterials } = cloneSceneMeshResources(clonedScene);
  clonedScene.userData.__ownedGeometries = ownedGeometries;
  clonedScene.userData.__ownedMaterials = ownedMaterials;
  return clonedScene;
}

function disposeModelSceneInstance(modelScene: Object3D) {
  const ownedGeometries = modelScene.userData.__ownedGeometries as BufferGeometry[] | undefined;
  if (ownedGeometries?.length) {
    for (const geometry of ownedGeometries) {
      geometry.dispose();
    }
  }
  modelScene.userData.__ownedGeometries = [];
  const ownedMaterials = modelScene.userData.__ownedMaterials as Material[] | undefined;
  if (ownedMaterials?.length) {
    for (const material of ownedMaterials) {
      disposeMaterial(material);
    }
  }
  modelScene.userData.__ownedMaterials = [];
}

function resolveModelTransform(transform: ShipMapTemplateProps["modelTransform"], fallbackScale: number): ResolvedModelTransform {
  return {
    scale: transform?.scale ?? fallbackScale,
    offset: transform?.offset ?? [0, 0, 0],
    rotation: transform?.rotation ?? [0, 0, 0],
  };
}

function createTransformMatrix(transform: ResolvedModelTransform): Matrix4 {
  const matrix = new Matrix4();
  const scale = new Vector3(transform.scale, transform.scale, transform.scale);
  matrix.makeRotationFromEuler(new Euler(transform.rotation[0], transform.rotation[1], transform.rotation[2]));
  matrix.scale(scale);
  matrix.setPosition(transform.offset[0], transform.offset[1], transform.offset[2]);
  return matrix;
}

function computeBoundsWithTransform(baseBounds: Box3, transform: ResolvedModelTransform): Box3 {
  const transformedBounds = baseBounds.clone();
  transformedBounds.applyMatrix4(createTransformMatrix(transform));
  return ensureFiniteBounds(transformedBounds);
}

function FitModelMesh({
  modelScene,
  transform,
  clippingPlanes,
  opacity = 1,
  ghosted = false,
  renderOrder = 0,
}: {
  modelScene: Object3D;
  transform: ResolvedModelTransform;
  clippingPlanes?: Plane[];
  opacity?: number;
  ghosted?: boolean;
  renderOrder?: number;
}) {
  useEffect(() => {
    const assignedMaterials: Material[] = [];
    modelScene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.renderOrder = renderOrder;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        assignedMaterials.push(material);
        material.clippingPlanes = clippingPlanes ?? [];
        material.clipShadows = Boolean(clippingPlanes?.length);
        material.transparent = ghosted || opacity < 1;
        material.opacity = opacity;
        material.depthWrite = !(ghosted || opacity < 0.999);
        if ("color" in material && material.color instanceof Color) {
          material.color = ghosted ? material.color.clone().multiplyScalar(0.72) : material.color;
        }
        material.needsUpdate = true;
      }
    });

    return () => {
      for (const material of assignedMaterials) {
        material.clippingPlanes = [];
        material.clipShadows = false;
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.needsUpdate = true;
      }
    };
  }, [modelScene, clippingPlanes, ghosted, opacity, renderOrder]);

  return (
    <group
      position={transform.offset}
      rotation={transform.rotation}
      scale={[transform.scale, transform.scale, transform.scale]}
    >
      <primitive object={modelScene} />
    </group>
  );
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
  const materialRef = useRef<MeshBasicMaterial | null>(null);
  const animatedOpacityRef = useRef(0);
  const animationStartRef = useRef<number | null>(null);

  const [planeWidth, planeDepth] = useMemo(
    () => resolveDeckPlaneSize(deck, modelSize),
    [deck, modelSize],
  );

  const y = deck.deckMin + yOffset;
  const rotationInPlane = -(((deck.rotationDeg ?? 0) * Math.PI) / 180);
  const offsetX = deck.offsetX ?? 0;
  const offsetZ = deck.offsetZ ?? 0;

  useEffect(() => {
    animatedOpacityRef.current = 0;
    animationStartRef.current = null;
    if (materialRef.current) {
      materialRef.current.opacity = 0;
    }
  }, [deck.id, texturePath]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    const now = clock.getElapsedTime();
    const startedAt = animationStartRef.current ?? now;
    if (animationStartRef.current === null) {
      animationStartRef.current = startedAt;
    }
    const progress = Math.min((now - startedAt) / 0.18, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const nextOpacity = opacity * eased;
    if (Math.abs(animatedOpacityRef.current - nextOpacity) < 0.002 && progress < 1) return;
    animatedOpacityRef.current = nextOpacity;
    material.opacity = nextOpacity;
  });

  return (
    <group position={[offsetX, y, offsetZ]} rotation={[-Math.PI / 2, 0, rotationInPlane]}>
      <mesh renderOrder={renderOrder}>
        <planeGeometry args={[planeWidth, planeDepth]} />
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          side={FrontSide}
          transparent
          opacity={0}
          depthTest
          depthWrite
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function resolveDeckMarkerIcon(annotation: ShipMapDeckComponentAnnotation | ShipMapDeckLabelAnnotation): DeckMarkerIconComponent | null {
  if (annotation.id === "crew-quarters-section") return CrewQuartersIcon;
  if (annotation.id === "armory-section") return ArmoryIcon;
  if (annotation.id === "elevator") return ElevatorIcon;
  if (annotation.id === "torpedo-operator-terminal") return TorpedoStationIcon;
  if (annotation.kind === "Ladder") return LadderIcon;
  if (annotation.kind === "Main Turret") return TurretStationIcon;
  if (annotation.kind === "Terminal") return EngineeringTerminalIcon;
  if (annotation.kind === "Power") return PowerPlantIcon;
  if (annotation.kind === "Shield") return ShieldGeneratorIcon;
  if (annotation.kind === "Cooler") return CoolerIcon;
  if (annotation.kind === "Radar") return RadarIcon;
  if (annotation.kind === "Quantum") return QuantumDriveIcon;
  if (annotation.kind === "Life-Support") return LifeSupportIcon;
  return null;
}

function projectWorldPointToOverlay(
  point: Vector3,
  camera: PerspectiveCamera,
  overlayBounds: DOMRect,
): ScreenPoint | null {
  const projected = point.clone().project(camera);
  if (projected.z < -1 || projected.z > 1) return null;

  return {
    x: ((projected.x + 1) * 0.5) * overlayBounds.width,
    y: ((1 - projected.y) * 0.5) * overlayBounds.height,
  };
}

function chainLegendPath(start: ScreenPoint, points: ScreenPoint[]): ScreenPoint[] {
  if (points.length === 0) return [];

  const remaining = [...points];
  const ordered: ScreenPoint[] = [];
  let cursor = start;

  while (remaining.length > 0) {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const dx = remaining[index].x - cursor.x;
      const dy = remaining[index].y - cursor.y;
      const distance = Math.hypot(dx, dy);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    const [nextPoint] = remaining.splice(closestIndex, 1);
    ordered.push(nextPoint);
    cursor = nextPoint;
  }

  return ordered;
}

function isExteriorMarkerVisible(annotation: ShipMapDeckComponentAnnotation | ShipMapDeckLabelAnnotation): boolean {
  return annotation.kind === "Power" || annotation.kind === "Shield" || annotation.kind === "Quantum";
}

function getTraceStateForAnnotation(
  annotation: ShipMapDeckComponentAnnotation | ShipMapDeckLabelAnnotation,
): DeckMarkerTraceState | null {
  const matchingLegendItem = DECK_MARKER_LEGEND.flatMap((section) => section.items).find((item) =>
    item.annotationIds.includes(annotation.id),
  );
  if (!matchingLegendItem) return null;

  return {
    key: `marker:${annotation.id}`,
    annotationIds: matchingLegendItem.annotationIds,
    color: matchingLegendItem.color,
    startAnnotationId: annotation.id,
  };
}

function getAnnotationWorldPosition(
  annotation: ShipMapDeckComponentAnnotation | ShipMapDeckLabelAnnotation,
  annotations?: ShipMapDeckAnnotationConfig,
): [number, number, number] {
  const offset = annotations?.worldOffset ?? [0, 0, 0];
  return [
    annotation.worldPosition[0] + offset[0],
    annotation.worldPosition[1] + offset[1],
    annotation.worldPosition[2] + offset[2],
  ];
}

function getVisibleLegendSections(
  deck: ShipMapDeckOverlay | null,
  showInterior: boolean,
): DeckMarkerLegendSection[] {
  const exteriorKeys = new Set<LegendItemKey>(["power", "shield", "quantum"]);
  if (!showInterior) {
    return DECK_MARKER_LEGEND.map((section) => ({
      ...section,
      items: section.items.filter((item) => exteriorKeys.has(item.key)),
    })).filter((section) => section.items.length > 0);
  }

  const annotationIds = new Set<string>();
  deck?.annotations?.components.forEach((annotation) => annotationIds.add(annotation.id));
  deck?.annotations?.labels.forEach((annotation) => annotationIds.add(annotation.id));

  return DECK_MARKER_LEGEND.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.annotationIds.some((id) => annotationIds.has(id))),
  })).filter((section) => section.items.length > 0);
}

function getDefaultDeckOverlayId(deckOverlayConfig?: ShipMapDeckOverlayConfig): string {
  if (!deckOverlayConfig?.decks.length) return "";
  return deckOverlayConfig.decks.find((deck) => deck.id.toLowerCase().includes("mid"))?.id ?? deckOverlayConfig.decks[0].id;
}

function DeckAnnotations({
  deck,
  showExteriorSubsetOnly = false,
  activeTraceAnnotationIds,
  onAnnotationHover,
  onAnnotationLeave,
  onAnnotationClick,
}: {
  deck: ShipMapDeckOverlay;
  showExteriorSubsetOnly?: boolean;
  activeTraceAnnotationIds?: readonly string[];
  onAnnotationHover?: (annotation: ShipMapDeckComponentAnnotation | ShipMapDeckLabelAnnotation) => void;
  onAnnotationLeave?: () => void;
  onAnnotationClick?: (annotation: ShipMapDeckComponentAnnotation | ShipMapDeckLabelAnnotation) => void;
}) {
  if (!deck.annotations) return null;

  const baseY = deck.deckMin;
  const stemHeight = Math.max(deck.annotations.fixedHeightAboveDeckMin, 0.02);
  const chipHeight = 0.012;
  const chipRadius = Math.max(Math.min((deck.deckMax - deck.deckMin) * 0.06, 0.026), 0.014);
  const items = [...deck.annotations.components, ...deck.annotations.labels].filter((annotation) =>
    showExteriorSubsetOnly ? isExteriorMarkerVisible(annotation) : true,
  );

  return (
    <>
      {items.map((annotation) => {
        const [worldX, , worldZ] = getAnnotationWorldPosition(annotation, deck.annotations);
        const MarkerIcon = resolveDeckMarkerIcon(annotation);
        const isTraceActive = activeTraceAnnotationIds?.includes(annotation.id) ?? false;
        const markerColor = isTraceActive ? "#f8fafc" : annotation.colorHint ?? "#93c5fd";
        const markerOpacity = isTraceActive ? 1 : 0.96;

        return (
          <group
            key={annotation.id}
            position={[worldX, baseY, worldZ]}
            onPointerEnter={() => onAnnotationHover?.(annotation)}
            onPointerLeave={() => onAnnotationLeave?.()}
            onClick={(event) => {
              event.stopPropagation();
              onAnnotationClick?.(annotation);
            }}
          >
            <mesh position={[0, stemHeight * 0.5, 0]} renderOrder={70}>
              <cylinderGeometry args={[0.0018, 0.0018, stemHeight, 10]} />
              <meshBasicMaterial color={markerColor} transparent opacity={isTraceActive ? 0.98 : 0.82} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh position={[0, stemHeight + chipHeight * 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={71}>
              <circleGeometry args={[chipRadius, 18]} />
              <meshBasicMaterial color={markerColor} transparent opacity={markerOpacity} depthTest={false} depthWrite={false} />
            </mesh>
            <Billboard position={[0, stemHeight + chipHeight + 0.012, 0]} follow lockX={false} lockY={false} lockZ={false}>
              {MarkerIcon ? (
                <Html center>
                  <div
                    className={`deck-marker-icon-badge ${isTraceActive ? "deck-marker-icon-badge-active" : ""}`}
                    style={{ "--marker-accent": markerColor } as React.CSSProperties}
                  >
                    <MarkerIcon className="deck-marker-icon-svg" />
                  </div>
                </Html>
              ) : (
                <Text
                  fontSize={chipRadius * 0.95}
                  maxWidth={chipRadius * 4}
                  anchorX="center"
                  anchorY="middle"
                  color="#f8fafc"
                  outlineWidth={0.003}
                  outlineColor="#02040a"
                >
                  {annotation.token ?? annotation.label}
                </Text>
              )}
            </Billboard>
          </group>
        );
      })}
    </>
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
  mergeMeshesForPerformance = false,
  modelTransform,
}: ShipMapTemplateProps) {
  const hasDeckOverlay = Boolean(deckOverlayConfig?.decks.length);
  const initialView = useMemo(() => readSavedView(viewStorageKey, fallbackView), [viewStorageKey, fallbackView]);
  const [modelScene, setModelScene] = useState<Object3D | null>(null);
  const [modelBounds, setModelBounds] = useState<Box3 | null>(null);
  const [modelSource, setModelSource] = useState<ModelSource | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ShipMapViewState>(initialView);
  const [viewSaveStatus, setViewSaveStatus] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [hoveredLegendKey, setHoveredLegendKey] = useState<LegendItemKey | null>(null);
  const [pinnedLegendKey, setPinnedLegendKey] = useState<LegendItemKey | null>(null);
  const [hoveredMarkerTrace, setHoveredMarkerTrace] = useState<DeckMarkerTraceState | null>(null);
  const [selectedAnnotationTraces, setSelectedAnnotationTraces] = useState<SelectedAnnotationTrace[]>([]);
  const [legendPaths, setLegendPaths] = useState<ScreenPath[]>([]);
  const [suggestedScale, setSuggestedScale] = useState<number | null>(null);
  const [sliceEnabled, setSliceEnabled] = useState(false);
  const [deckBounds, setDeckBounds] = useState<{ min: number; max: number }>({ min: -1, max: 1 });
  const [deckMin, setDeckMin] = useState(-1);
  const [deckMax, setDeckMax] = useState(1);
  const [deckOverlayEnabled, setDeckOverlayEnabled] = useState(false);
  const [deckOverlayVisualProgress, setDeckOverlayVisualProgress] = useState(0);
  const [activeDeckOverlayId, setActiveDeckOverlayId] = useState(getDefaultDeckOverlayId(deckOverlayConfig));
  const [modelFootprint, setModelFootprint] = useState<{ x: number; z: number }>({ x: 1, z: 1 });
  const [deckOverlayRegions, setDeckOverlayRegions] = useState<DeckOverlayRegion[]>([]);
  const [deckOverlayViewBox, setDeckOverlayViewBox] = useState<string | null>(null);
  const [deckOverlayRegionsLoading, setDeckOverlayRegionsLoading] = useState(false);
  const [deckOverlayRegionsError, setDeckOverlayRegionsError] = useState<string | null>(null);
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);
  const [hoveredRegionKey, setHoveredRegionKey] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [pickedTarget, setPickedTarget] = useState<[number, number, number] | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerShellRef = useRef<HTMLDivElement | null>(null);
  const legendItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectedItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deckOverlayVisualProgressRef = useRef(0);
  const lastControlsSampleRef = useRef(0);
  const pickRayRef = useRef(new Raycaster());
  const pickPointerRef = useRef(new Vector2());

  const topDownHeight = useMemo(() => {
    const span = Math.max(deckBounds.max - deckBounds.min, 1);
    return deckBounds.max + span * 1.2;
  }, [deckBounds]);

  const activeDeckOverlay = useMemo(
    () => deckOverlayConfig?.decks.find((deck) => deck.id === activeDeckOverlayId) ?? null,
    [deckOverlayConfig, activeDeckOverlayId],
  );
  const exteriorDeckOverlay = useMemo<ShipMapDeckOverlay | null>(() => {
    if (!deckOverlayConfig?.decks.length) return null;
    const sourceDecks = deckOverlayConfig.decks.filter((deck) => deck.annotations);
    if (sourceDecks.length === 0) return null;

    const components = sourceDecks.flatMap((deck) => deck.annotations?.components ?? []).filter(isExteriorMarkerVisible);
    const labels = sourceDecks.flatMap((deck) => deck.annotations?.labels ?? []).filter(isExteriorMarkerVisible);
    const baseDeck =
      deckOverlayConfig.decks.find((deck) => deck.id.toLowerCase().includes("mid") && deck.annotations) ??
      activeDeckOverlay ??
      sourceDecks[0];
    return {
      ...baseDeck,
      annotations: {
        fixedHeightAboveDeckMin: sourceDecks[0].annotations?.fixedHeightAboveDeckMin ?? 0.02,
        worldOffset: sourceDecks[0].annotations?.worldOffset,
        components,
        labels,
      },
    };
  }, [activeDeckOverlay, deckOverlayConfig]);
  const interactiveDeckOverlay = deckOverlayEnabled ? activeDeckOverlay : exteriorDeckOverlay;
  const activeLegendKey = pinnedLegendKey ?? hoveredLegendKey;
  const activeLegendItem = useMemo(
    () => DECK_MARKER_LEGEND.flatMap((section) => section.items).find((item) => item.key === activeLegendKey) ?? null,
    [activeLegendKey],
  );
  const selectedAnnotationIds = useMemo(() => selectedAnnotationTraces.map((trace) => trace.id), [selectedAnnotationTraces]);
  const activeTrace = useMemo<DeckMarkerTraceState | null>(() => {
    if (pinnedLegendKey && activeLegendItem) {
      return {
        key: `legend:${pinnedLegendKey}`,
        annotationIds: activeLegendItem.annotationIds,
        color: activeLegendItem.color,
      };
    }
    if (hoveredMarkerTrace) return hoveredMarkerTrace;
    if (hoveredLegendKey && activeLegendItem) {
      return {
        key: `legend:${hoveredLegendKey}`,
        annotationIds: activeLegendItem.annotationIds,
        color: activeLegendItem.color,
      };
    }
    return null;
  }, [activeLegendItem, hoveredLegendKey, hoveredMarkerTrace, pinnedLegendKey]);
  const effectiveModelTransform = useMemo(
    () => resolveModelTransform(modelTransform, suggestedScale ?? 1),
    [modelTransform, suggestedScale],
  );
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
  const activeDeckShadowTextureUri = useMemo(() => buildDeckShadowTextureDataUri(), []);
  const deckOverlayVisualActive = deckOverlayVisualProgress > 0.001;
  const viewerBackdropStyle = useMemo(
    () =>
      ({
        "--ship-x": "50%",
        "--ship-y": "48%",
      }) as React.CSSProperties,
    [],
  );
  const activeDeckCutY = useMemo(() => {
    if ((!sliceEnabled && !deckOverlayVisualActive) || !activeDeckOverlay) return null;
    return Math.min(deckBounds.max, activeDeckOverlay.deckMin + 0.02);
  }, [sliceEnabled, deckOverlayVisualActive, activeDeckOverlay, deckBounds.max]);
  const activeAnnotationIds = useMemo(() => {
    const ids = new Set<string>(selectedAnnotationIds);
    activeTrace?.annotationIds.forEach((id) => ids.add(id));
    return [...ids];
  }, [activeTrace, selectedAnnotationIds]);
  const visibleLegendSections = useMemo(
    () => getVisibleLegendSections(interactiveDeckOverlay, deckOverlayEnabled),
    [interactiveDeckOverlay, deckOverlayEnabled],
  );
  const lowerHullClippingPlanes = useMemo(() => {
    if (activeDeckCutY === null) return [];
    return [new Plane(new Vector3(0, -1, 0), activeDeckCutY)];
  }, [activeDeckCutY]);
  const lowerHullGhostScene = useMemo(() => {
    if (!modelScene) return null;
    return cloneModelSceneForPass(modelScene);
  }, [modelScene]);

  useEffect(() => {
    if (!deckOverlayConfig?.decks.length) return;
    if (deckOverlayConfig.decks.some((deck) => deck.id === activeDeckOverlayId)) return;
    setActiveDeckOverlayId(getDefaultDeckOverlayId(deckOverlayConfig));
  }, [activeDeckOverlayId, deckOverlayConfig]);

  useEffect(() => {
    if (!interactiveDeckOverlay?.annotations) {
      setLegendPaths([]);
      return;
    }

    const viewerShell = viewerShellRef.current;
    const camera = cameraRef.current;
    if (!viewerShell || !camera) {
      setLegendPaths([]);
      return;
    }

    const overlayBounds = viewerShell.getBoundingClientRect();
    const y = interactiveDeckOverlay.deckMin + Math.max(interactiveDeckOverlay.annotations.fixedHeightAboveDeckMin, 0.02) + 0.012;
    const allAnnotations = [...interactiveDeckOverlay.annotations.components, ...interactiveDeckOverlay.annotations.labels];

    if (selectedAnnotationIds.length > 0) {
      const selectedScreenPaths = selectedAnnotationTraces
        .map((trace) => {
          const annotation = allAnnotations.find((item) => item.id === trace.id);
          if (!annotation) return null;
          const [worldX, , worldZ] = getAnnotationWorldPosition(annotation, interactiveDeckOverlay.annotations);
          const targetPoint = projectWorldPointToOverlay(new Vector3(worldX, y, worldZ), camera, overlayBounds);
          const sourceElement = selectedItemRefs.current[trace.id];
          if (!targetPoint || !sourceElement) return null;
          const sourceBounds = sourceElement.getBoundingClientRect();
          const sourcePoint = {
            x: sourceBounds.right - overlayBounds.left,
            y: sourceBounds.top - overlayBounds.top + sourceBounds.height * 0.5,
          };
          return { points: [sourcePoint, targetPoint], color: trace.color };
        })
        .filter((path): path is ScreenPath => path !== null);

      setLegendPaths(selectedScreenPaths);
      return;
    }

    if (!activeTrace) {
      setLegendPaths([]);
      return;
    }

    const matchingAnnotations = allAnnotations.filter((annotation) => activeTrace.annotationIds.includes(annotation.id));

    const projectedById = new Map<string, ScreenPoint>();
    for (const annotation of matchingAnnotations) {
      const [worldX, , worldZ] = getAnnotationWorldPosition(annotation, interactiveDeckOverlay.annotations);
      const projected = projectWorldPointToOverlay(
        new Vector3(worldX, y, worldZ),
        camera,
        overlayBounds,
      );
      if (projected) {
        projectedById.set(annotation.id, projected);
      }
    }

    if (projectedById.size === 0) {
      setLegendPaths([]);
      return;
    }

    let startPoint: ScreenPoint | null = null;
    const startAnnotationId = activeTrace.startAnnotationId;
    if (startAnnotationId) {
      startPoint = projectedById.get(startAnnotationId) ?? null;
    } else {
      const legendElement = legendItemRefs.current[activeLegendKey ?? ""];
      if (legendElement) {
        const legendBounds = legendElement.getBoundingClientRect();
        startPoint = {
          x: legendBounds.right - overlayBounds.left,
          y: legendBounds.top - overlayBounds.top + legendBounds.height * 0.5,
        };
      }
    }

    if (!startPoint) {
      setLegendPaths([]);
      return;
    }

    const chainedPoints = matchingAnnotations
      .filter((annotation) => annotation.id !== startAnnotationId)
      .map((annotation) => projectedById.get(annotation.id) ?? null)
      .filter((point): point is ScreenPoint => point !== null);

    setLegendPaths([{ points: [startPoint, ...chainLegendPath(startPoint, chainedPoints)], color: activeTrace.color }]);
  }, [interactiveDeckOverlay, activeLegendKey, activeTrace, currentView, selectedAnnotationIds, selectedAnnotationTraces]);

  function handleControlsChange() {
    const now = performance.now();
    if (now - lastControlsSampleRef.current < 80) return;
    lastControlsSampleRef.current = now;

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

  async function copyTargetJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(pickedTarget ?? currentView.target));
      setCopyStatus("Target copied.");
    } catch {
      setCopyStatus("Copy failed.");
    }
  }

  function handleViewportPick(event: React.MouseEvent<HTMLDivElement>) {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    pickPointerRef.current.set(x, y);
    pickRayRef.current.setFromCamera(pickPointerRef.current, camera);

    const planeY = activeDeckOverlay?.deckMin ?? controlsRef.current?.target.y ?? 0;
    const pickingPlane = new Plane(new Vector3(0, 1, 0), -planeY);
    const hitPoint = new Vector3();

    if (!pickRayRef.current.ray.intersectPlane(pickingPlane, hitPoint)) return;

    setPickedTarget([round3(hitPoint.x), round3(hitPoint.y), round3(hitPoint.z)]);
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
    let cancelled = false;
    let acquiredAsset = false;

    setLoadError(null);
    setModelScene(null);
    setModelBounds(null);
    setModelSource(resolveModelSource(modelPath));
    setSuggestedScale(null);

    async function loadModel() {
      try {
        const asset = await acquireModelAsset(modelPath);
        acquiredAsset = true;
        if (cancelled) {
          releaseModelAsset(modelPath);
          return;
        }

        const sceneInstance = createModelSceneInstance(asset, mergeMeshesForPerformance);
        setModelScene(sceneInstance);
        setModelBounds(asset.baseBounds.clone());
        setModelSource(asset.source);
        setSuggestedScale(asset.suggestedScale);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unknown model parsing error";
        setLoadError(message);
      }
    }

    void loadModel();

    return () => {
      cancelled = true;
      if (acquiredAsset) {
        releaseModelAsset(modelPath);
      }
    };
  }, [modelPath, mergeMeshesForPerformance]);

  useEffect(() => {
    if (!modelScene || !modelBounds) return;

    const transformedBounds = computeBoundsWithTransform(modelBounds, effectiveModelTransform);
    const size = new Vector3();
    transformedBounds.getSize(size);

    setDeckBounds({ min: transformedBounds.min.y, max: transformedBounds.max.y });
    setDeckMin(transformedBounds.min.y);
    setDeckMax(transformedBounds.max.y);
    setModelFootprint({ x: Math.max(size.x, 0.1), z: Math.max(size.z, 0.1) });
  }, [modelScene, modelBounds, effectiveModelTransform]);

  useEffect(() => {
    return () => {
      if (!modelScene) return;
      disposeModelSceneInstance(modelScene);
    };
  }, [modelScene]);

  useEffect(() => {
    return () => {
      if (!lowerHullGhostScene) return;
      disposeModelSceneInstance(lowerHullGhostScene);
    };
  }, [lowerHullGhostScene]);

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
    deckOverlayVisualProgressRef.current = deckOverlayVisualProgress;
  }, [deckOverlayVisualProgress]);

  useEffect(() => {
    if (!hasDeckOverlay) {
      setDeckOverlayVisualProgress(0);
      return;
    }

    let frameId = 0;
    let startTime = 0;
    const startValue = deckOverlayVisualProgressRef.current;
    const targetValue = deckOverlayEnabled ? 1 : 0;
    if (Math.abs(targetValue - startValue) < 0.001) return;

    const durationMs = 280;
    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      const eased = 0.5 - Math.cos(progress * Math.PI) * 0.5;
      const nextValue = startValue + (targetValue - startValue) * eased;
      setDeckOverlayVisualProgress(nextValue);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [hasDeckOverlay, deckOverlayEnabled]);

  useEffect(() => {
    let cancelled = false;

    setDeckOverlayRegions([]);
    setDeckOverlayViewBox(null);
    setDeckOverlayRegionsError(null);
    setSelectedRegionKey(null);
    setHoveredRegionKey(null);

    if (!activeDeckOverlay || !activeDeckOverlay.svgPath) return;
    const overlay = activeDeckOverlay;
    const overlayPath = overlay.svgPath!;

    async function loadDeckRegions() {
      try {
        setDeckOverlayRegionsLoading(true);
        const response = await fetch(overlayPath);
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
          <div
            ref={viewerShellRef}
            className="ship-viewer-shell relative h-[72vh] min-h-[620px] w-full rounded-[1.2rem] border border-white/15"
            style={viewerBackdropStyle}
          >
            <div className="ship-viewer-bg rounded-[1.2rem]" />
            <div className="ship-stars rounded-[1.2rem]" />
            <div className="ship-viewer-grid rounded-[1.2rem]" />
            <div className="ship-backlight ship-backlight-large rounded-[1.2rem]" />
            <div
              className="map-deck-viewport relative h-full w-full overflow-hidden rounded-[1.2rem]"
              onClick={handleViewportPick}
            >
              <Canvas
              dpr={[1, 1.5]}
              gl={{ localClippingEnabled: true, preserveDrawingBuffer: true }}
              camera={{ position: initialView.position, fov: 42 }}
              onCreated={({ gl, camera }) => {
                gl.localClippingEnabled = true;
                canvasRef.current = gl.domElement;
                cameraRef.current = camera as PerspectiveCamera;
              }}
            > {/* Color of sun below */}
              <ambientLight intensity={1.15} color="#d7ecff" />
              <directionalLight position={[18, 24, 20]} intensity={6} color="#586781b6" />
              <directionalLight position={[-30, 9, -20]} intensity={6.4} color="#8997a7" />
              {modelScene ? (
                <>
                  <FitModelMesh
                    modelScene={modelScene}
                    transform={effectiveModelTransform}
                    opacity={Math.max(0, 1 - deckOverlayVisualProgress)}
                  />
                  {deckOverlayVisualActive && activeDeckCutY !== null && lowerHullGhostScene ? (
                    <FitModelMesh
                      modelScene={lowerHullGhostScene}
                      transform={effectiveModelTransform}
                      clippingPlanes={lowerHullClippingPlanes}
                      opacity={0.14 * deckOverlayVisualProgress}
                      ghosted
                      renderOrder={4}
                    />
                  ) : null}
                </>
              ) : null}
              {deckOverlayVisualActive && activeDeckOverlay && modelScene ? (
                <DeckOverlayPlane
                  deck={{
                    ...activeDeckOverlay,
                    scaleMultiplier: (activeDeckOverlay.scaleMultiplier ?? 1) * 1.08,
                  }}
                  modelSize={modelFootprint}
                  texturePath={activeDeckShadowTextureUri}
                  opacity={0.3 * deckOverlayVisualProgress}
                  renderOrder={40}
                  yOffset={-0.01}
                />
              ) : null}
              {deckOverlayVisualActive && activeDeckOverlay?.svgPath && modelScene ? (
                <DeckOverlayPlane
                  deck={activeDeckOverlay}
                  modelSize={modelFootprint}
                  texturePath={activeDeckOverlay.svgPath}
                  opacity={0.95 * deckOverlayVisualProgress}
                  renderOrder={41}
                />
              ) : null}
              {interactiveDeckOverlay && modelScene ? (
                <DeckAnnotations
                  deck={interactiveDeckOverlay}
                  showExteriorSubsetOnly={!deckOverlayVisualActive}
                  activeTraceAnnotationIds={activeAnnotationIds}
                  onAnnotationHover={(annotation) => {
                    if (selectedAnnotationIds.length > 0 || pinnedLegendKey) return;
                    setHoveredMarkerTrace(getTraceStateForAnnotation(annotation));
                  }}
                  onAnnotationLeave={() => {
                    if (selectedAnnotationIds.length > 0 || pinnedLegendKey) return;
                    setHoveredMarkerTrace(null);
                  }}
                  onAnnotationClick={(annotation) => {
                    const nextTrace = getTraceStateForAnnotation(annotation);
                    const nextColor = nextTrace?.color ?? annotation.colorHint ?? "#93c5fd";
                    setPinnedLegendKey(null);
                    setHoveredLegendKey(null);
                    setHoveredMarkerTrace(null);
                    setSelectedAnnotationTraces((current) =>
                      current.some((entry) => entry.id === annotation.id)
                        ? current.filter((entry) => entry.id !== annotation.id)
                        : [...current, { id: annotation.id, label: annotation.label, color: nextColor }],
                    );
                  }}
                />
              ) : null}
              {deckOverlayVisualActive && activeDeckOverlay && activeDeckRegionHighlightUri && modelScene ? (
                <DeckOverlayPlane
                  deck={activeDeckOverlay}
                  modelSize={modelFootprint}
                  texturePath={activeDeckRegionHighlightUri}
                  opacity={0.98 * deckOverlayVisualProgress}
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
            </div>

            {legendPaths.some((path) => path.points.length > 1) ? (
              <svg
                className="map-legend-path-overlay absolute inset-0 z-10"
                viewBox={`0 0 ${Math.max(viewerShellRef.current?.clientWidth ?? 0, 1)} ${Math.max(viewerShellRef.current?.clientHeight ?? 0, 1)}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {legendPaths.map((path, pathIndex) => (
                  <g key={`${path.color}-${pathIndex}`} style={{ "--legend-path-accent": path.color } as React.CSSProperties}>
                    <polyline
                      points={path.points.map((point) => `${point.x},${point.y}`).join(" ")}
                      className="map-legend-path-line"
                    />
                    {path.points.slice(1).map((point, index) => (
                      <g key={`${point.x}-${point.y}-${index}`}>
                        <circle cx={point.x} cy={point.y} r="9.5" className="map-legend-path-hit-core" />
                        <circle cx={point.x} cy={point.y} r="12.5" className="map-legend-path-hit-ring" />
                      </g>
                    ))}
                  </g>
                ))}
              </svg>
            ) : null}

            <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-col gap-2">
              {hasDeckOverlay ? (
                <button
                  type="button"
                  onClick={() => setDeckOverlayEnabled((enabled) => !enabled)}
                  className={`rounded-md border border-white/35 bg-black/50 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/65 ${
                    deckOverlayEnabled ? "map-selection-active" : ""
                  }`}
                >
                  {deckOverlayEnabled ? "Exterior" : "Interior"}
                </button>
              ) : null}

              {hasDeckOverlay && deckOverlayConfig ? (
                <>
                  {deckOverlayConfig.decks.at(-1) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const topDeck = deckOverlayConfig.decks.at(-1);
                        if (!topDeck) return;
                        setActiveDeckOverlayId(topDeck.id);
                        setDeckOverlayEnabled(true);
                      }}
                      className={`rounded-md border px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition ${
                        deckOverlayConfig.decks.at(-1)?.id === activeDeckOverlayId
                          ? "map-selection-active border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
                          : "border-white/30 bg-black/45 text-slate-100 hover:bg-black/65"
                      }`}
                    >
                      Top Deck
                    </button>
                  ) : null}
                  {deckOverlayConfig.decks.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const midDeck = deckOverlayConfig.decks[1];
                        setActiveDeckOverlayId(midDeck.id);
                        setDeckOverlayEnabled(true);
                      }}
                      className={`rounded-md border px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition ${
                        deckOverlayConfig.decks[1]?.id === activeDeckOverlayId
                          ? "map-selection-active border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
                          : "border-white/30 bg-black/45 text-slate-100 hover:bg-black/65"
                      }`}
                    >
                      Mid Deck
                    </button>
                  ) : null}
                  {deckOverlayConfig.decks[0] ? (
                    <button
                      type="button"
                      onClick={() => {
                        const bottomDeck = deckOverlayConfig.decks[0];
                        setActiveDeckOverlayId(bottomDeck.id);
                        setDeckOverlayEnabled(true);
                      }}
                      className={`rounded-md border px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition ${
                        deckOverlayConfig.decks[0].id === activeDeckOverlayId
                          ? "map-selection-active border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
                          : "border-white/30 bg-black/45 text-slate-100 hover:bg-black/65"
                      }`}
                    >
                      Lower Deck
                    </button>
                  ) : null}
                </>
              ) : null}

              {hasDeckOverlay ? (
                <section className="map-legend-panel rounded-xl border border-white/20 bg-black/55 p-3 backdrop-blur-md">
                  {visibleLegendSections.map((section) => (
                    <div key={section.title} className="map-legend-section">
                      <p className="map-legend-heading">{section.title}</p>
                      <div className="map-legend-items">
                        {section.items.map(({ key, label, color, Icon }) => (
                          <div
                            key={label}
                            ref={(node) => {
                              legendItemRefs.current[key] = node;
                            }}
                            className={`map-legend-item ${activeLegendKey === key ? "map-legend-item-active" : ""}`}
                            style={{ "--legend-accent": color } as React.CSSProperties}
                            onMouseEnter={() => {
                              if (!pinnedLegendKey && selectedAnnotationIds.length === 0) setHoveredLegendKey(key);
                            }}
                            onMouseLeave={() => {
                              if (!pinnedLegendKey && selectedAnnotationIds.length === 0) setHoveredLegendKey(null);
                            }}
                            onClick={() => {
                              setSelectedAnnotationTraces([]);
                              setHoveredMarkerTrace(null);
                              setPinnedLegendKey((current) => (current === key ? null : key));
                              setHoveredLegendKey(null);
                            }}
                          >
                            <span className="map-legend-icon" aria-hidden>
                              <Icon className="map-legend-icon-svg" />
                            </span>
                            <span className="map-legend-label">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {selectedAnnotationTraces.length > 0 ? (
                    <div className="map-legend-section">
                      <p className="map-legend-heading">Selected</p>
                      <div className="map-legend-items">
                        {selectedAnnotationTraces.map((trace) => (
                          <button
                            key={trace.id}
                            type="button"
                            ref={(node) => {
                              selectedItemRefs.current[trace.id] = node;
                            }}
                            className="map-legend-item map-legend-item-active w-full border-0 bg-transparent p-0 text-left"
                            style={{ "--legend-accent": trace.color } as React.CSSProperties}
                            onClick={() => {
                              setSelectedAnnotationTraces((current) => current.filter((entry) => entry.id !== trace.id));
                            }}
                          >
                            <span className="map-legend-swatch" aria-hidden />
                            <span className="map-legend-label">{trace.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>

            <aside
              className={`map-controls-panel absolute bottom-4 right-4 z-10 flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border border-white/20 bg-black/60 backdrop-blur-md transition ${
                controlsOpen ? "w-[min(340px,calc(100%-2rem))]" : "w-auto"
              }`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
                <div className={`${controlsOpen ? "opacity-100" : "pointer-events-none w-0 overflow-hidden opacity-0"} transition`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-100">Map Controls</p>
                </div>
                <button
                  type="button"
                  onClick={() => setControlsOpen((open) => !open)}
                  className="min-h-11 rounded-md border border-white/30 bg-black/45 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white transition hover:bg-black/65"
                  aria-expanded={controlsOpen}
                  aria-controls="map-controls-panel-body"
                >
                  {controlsOpen ? "Hide" : "Controls"}
                </button>
              </div>

              <div
                id="map-controls-panel-body"
                className={`map-controls-panel-body flex flex-col gap-2 overflow-y-auto p-3 ${controlsOpen ? "" : "hidden"}`}
              >
                {sliceEnabled && !hasDeckOverlay ? (
                  <div className="rounded-md border border-white/20 bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
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

                <div className="rounded-md border border-white/20 bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-100">Dev purpose only controls</p>
                  <p className="mt-2">slice: {sliceEnabled ? "enabled" : "disabled"}</p>
                  <p>deck: [{round3(deckMin)}, {round3(deckMax)}]</p>
                  {activeDeckOverlay ? <p>active floor: {activeDeckOverlay.title}</p> : null}
                  <p>suggestedScale: {suggestedScale === null ? "n/a" : round3(suggestedScale)}</p>
                  <p>cam: [{currentView.position.join(", ")}]</p>
                  <button
                    type="button"
                    onClick={copyTargetJson}
                    className="text-left text-slate-200 transition hover:text-cyan-100"
                    title="Copy target coordinates"
                  >
                    target: [{(pickedTarget ?? currentView.target).join(", ")}]
                  </button>
                  {viewSaveStatus ? <p className="mt-1 text-cyan-200">{viewSaveStatus}</p> : null}
                  {copyStatus ? <p className="mt-1 text-cyan-200">{copyStatus}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2 rounded-md border border-white/20 bg-black/55 p-2">
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
                                    ? "map-selection-active border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
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
                          coords: {activeDeckRegion ? `[${activeDeckRegion.centerX}, ${activeDeckRegion.centerY}]` : "none"}
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
            </aside>

            {!modelScene && !loadError ? (
              <p className="absolute inset-x-0 top-4 text-center text-xs uppercase tracking-[0.15em] text-cyan-200/85">
                Loading {modelSource === null ? "model" : `${modelSource.toUpperCase()} model`}...
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
