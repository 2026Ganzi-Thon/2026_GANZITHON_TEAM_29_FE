import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { GLView } from 'expo-gl';
import { Renderer, THREE, TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { encode } from 'base64-arraybuffer';
import { GLTFLoader } from 'three-stdlib';

import { useSettings } from '../settings/SettingsContext';

global.THREE = global.THREE || THREE;

// 농장 모델 안의 창고 오브젝트. 누르면 설정 창이 열림
const BARN_NODE_NAME = 'farm scene 3d model.004';
const BARN_HIT_PADDING = 0.1;

// 작물 크기: 밭 한 칸 너비 대비 비율 (새싹 화분 / 자라는 작물)
const CROP_SEED_RATIO = 0.45;
const CROP_PLANT_RATIO = 0.7;
// 테두리 윗면보다 살짝 아래(흙 높이)에 놓기
const CROP_SINK_RATIO = 0.18;
const CROP_SEED_SINK_RATIO = 0.3;

// 밭 한 칸 터치 인식 반경 배율
const PLOT_TOUCH_RADIUS_RATIO = 2;

// 수확 연출(harvestScene.js)에서도 씀
export const CROP_MESH_MAP = {
  '새싹채소_새싹': 'cartoon_vegetables_3d_model001',
  '새싹채소_1': 'plant_seedling_3d_model001',
  '새싹채소_2': 'plant_seedling_3d_model002',
  '새싹채소_3': 'plant_seedling_3d_model003',

  '당근_새싹': 'cartoon_vegetables_3d_model001',
  '당근_1': 'plant_seedling_3d_model004',
  '당근_2': 'plant_seedling_3d_model005',
  '당근_3': 'plant_seedling_3d_model006',

  '토마토_새싹': 'cartoon_vegetables_3d_model001',
  '토마토_1': 'plant_seedling_3d_model009',
  '토마토_2': 'plant_seedling_3d_model008',
  '토마토_3': 'cartoon_vegetables_3d_model009',

  '옥수수_새싹': 'cartoon_vegetables_3d_model001',
  '옥수수_1': 'plant_seedling_3d_model010',
  '옥수수_2': 'plant_seedling_3d_model011',
  '옥수수_3': 'cartoon_vegetables_3d_model012',

  '딸기_새싹': 'cartoon_vegetables_3d_model001',
  '딸기_1': 'plant_seedling_3d_model013',
  '딸기_2': 'plant_seedling_3d_model014',
  '딸기_3': 'plant_seedling_3d_model015',

  '호박_새싹': 'cartoon_vegetables_3d_model001',
  '호박_1': 'plant_seedling_3d_model020',
  '호박_2': 'plant_seedling_3d_model019',
  '호박_3': 'plant_seedling_3d_model018',
};

function resolveCropMeshKey(cropName, stage = 1) {
  const numStage = Number(stage) || 1;
  // 1단계: 새싹 / 2단계: 성장 / 3단계 이상: 열매
  if (numStage == 1) return `${cropName}_새싹`;
  if (numStage == 2) return `${cropName}_1`;
  if (numStage == 3) return `${cropName}_2`;
  return `${cropName}_3`;
}

async function readLocalFile(uri) {
  try {
    const response = await fetch(uri);
    if (response.ok) return await response.arrayBuffer();
  } catch (e) {
    console.log('❌ fetch 실패:', e?.message);
  }
  const file = new File(uri);
  return await file.arrayBuffer();
}

function createSafeGLTFLoader(prefix) {
  const textureLoader = new TextureLoader();
  const loader = new GLTFLoader();

  loader.register((parser) => {
    const textureCache = new Map();
    parser.loadImageSource = async (sourceIndex) => {
      if (textureCache.has(sourceIndex)) {
        return textureCache.get(sourceIndex).then((t) => t.clone());
      }
      const texturePromise = (async () => {
        const imageSource = parser.json.images[sourceIndex];
        if (!imageSource) throw new Error('텍스처 없음');
        const imageBuffer = await parser.getDependency('bufferView', imageSource.bufferView);
        const base64Data = encode(imageBuffer);
        const textureUri = `${FileSystem.cacheDirectory}${prefix}_texture_${sourceIndex}.png`;
        await FileSystem.writeAsStringAsync(textureUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const texture = await new Promise((resolve, reject) => {
          textureLoader.load(textureUri, resolve, undefined, reject);
        });
        texture.flipY = false;
        texture.encoding = THREE.sRGBEncoding;
        return texture;
      })();
      textureCache.set(sourceIndex, texturePromise);
      return texturePromise;
    };
    return { name: 'RNTextureLoader' };
  });

  return loader;
}

function safeConfigureMaterial(mat) {
  if (!mat) return mat;
  if (mat.map) {
    mat.map.encoding = THREE.sRGBEncoding;
    mat.map.flipY = false;
  }
  return mat;
}

function applySelectionStyleToMesh(mesh, isSelected) {
  if (!mesh?.material) return;

  const applySelectionStyle = (mat) => {
    if (!mat) return;
    if (!mat.userData.originalColor) {
      mat.userData.originalColor = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);
    }

    if (isSelected) {
      if (mat.color) mat.color.setHex(0xffea75);
      if ('emissive' in mat) {
        mat.emissive = new THREE.Color(0xfbfb36);
        mat.emissiveIntensity = 0.9;
      }
    } else {
      if (mat.color && mat.userData.originalColor) {
        mat.color.copy(mat.userData.originalColor);
      }
      if ('emissive' in mat) {
        mat.emissive = new THREE.Color(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  };

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(applySelectionStyle);
  } else {
    applySelectionStyle(mesh.material);
  }
}

let farmModelPromise = null;
async function loadFarmModel() {
  if (!farmModelPromise) {
    farmModelPromise = (async () => {
      const modelAsset = Asset.fromModule(require('../../../assets/models/farms/farm_1.glb'));
      await modelAsset.downloadAsync();
      const arrayBuffer = await readLocalFile(modelAsset.localUri);
      const loader = createSafeGLTFLoader('farm');
      const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));

      const farmModel = gltf.scene;
      farmModel.traverse((child) => {
        if (child.isMesh) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => safeConfigureMaterial(m.clone()));
          } else if (child.material) {
            child.material = safeConfigureMaterial(child.material.clone());
          }
        }
      });

      farmModel.updateMatrixWorld(true);
      const boundingBox = new THREE.Box3().setFromObject(farmModel);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      boundingBox.getCenter(center);
      boundingBox.getSize(size);

      farmModel.position.sub(center);
      const maxDimension = Math.max(size.x, size.y, size.z);
      if (maxDimension > 0) {
        farmModel.scale.multiplyScalar(3.5 / maxDimension);
      }
      farmModel.updateMatrixWorld(true);
      return farmModel;
    })();
  }
  return farmModelPromise;
}

let cropsModelPromise = null;
export async function loadCropsModel() {
  if (!cropsModelPromise) {
    cropsModelPromise = (async () => {
      const cropAsset = Asset.fromModule(require('../../../assets/models/farms/crops.glb'));
      await cropAsset.downloadAsync();
      const cropBuffer = await readLocalFile(cropAsset.localUri);
      const cropLoader = createSafeGLTFLoader('crop');
      const cropGltf = await new Promise((resolve, reject) => cropLoader.parse(cropBuffer, '', resolve, reject));

      cropGltf.scene.traverse((child) => {
        if (child.isMesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach(safeConfigureMaterial);
          } else if (child.material) {
            safeConfigureMaterial(child.material);
          }
          if (child.geometry && !child.geometry.boundingBox) {
            child.geometry.computeBoundingBox();
          }
        }
      });
      cropGltf.scene.updateMatrixWorld(true);
      return cropGltf.scene;
    })();
  }
  return cropsModelPromise;
}

const extraModelPromises = {};
export function loadExtraModel(key, assetModule) {
  if (!extraModelPromises[key]) {
    extraModelPromises[key] = (async () => {
      const asset = Asset.fromModule(assetModule);
      await asset.downloadAsync();
      const buffer = await readLocalFile(asset.localUri);
      const loader = createSafeGLTFLoader(key);
      const gltf = await new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject));

      gltf.scene.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(safeConfigureMaterial);
        }
      });
      return gltf.scene;
    })().catch((error) => {
      delete extraModelPromises[key];
      throw error;
    });
  }
  return extraModelPromises[key];
}

const PLOT_FRAME_NAME = 'farm scene 3d model_frame';
const PLOT_FRAME_COLOR = 0xffd84d;
const PLOT_FRAME_SCALE = 1.04;
const PLOT_FLASH_SECONDS = 1;

export async function loadPlotFrame() {
  const props = await loadExtraModel('props', require('../../../assets/models/props/props.glb'));
  return (
    props.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(PLOT_FRAME_NAME)) ??
    props.getObjectByName(PLOT_FRAME_NAME)
  );
}

export function createPlotFrame(source, plotCenter, farmScale) {
  const box = new THREE.Box3().setFromObject(source);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const material = new THREE.MeshBasicMaterial({
    color: PLOT_FRAME_COLOR,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(source.geometry, material);
  mesh.position.set(source.position.x - center.x, source.position.y - box.max.y, source.position.z - center.z);
  mesh.quaternion.copy(source.quaternion);
  mesh.scale.copy(source.scale);

  const group = new THREE.Group();
  group.add(mesh);
  group.position.set(plotCenter.x, plotCenter.y + plotCenter.width * 0.01, plotCenter.z);
  group.scale.setScalar(farmScale * PLOT_FRAME_SCALE);

  return { group, material, dispose: () => material.dispose() };
}

export default function FarmScene3D({
  backgroundColor = 0xf5f1e8,
  visibleWidth,
  cameraAngle = 50,
  cameraPos,
  modelOffsetY = 0,
  plotsData = [],
  selectedPlotIndex,
  onSelectPlot,
  onPressBackground,
  onSceneReady,
  flashPlotIndex,
  flashKey,
  blurred = false,
  opacity = 1,
}) {
  const isFocused = useIsFocused();
  const settings = useSettings();

  return (
    <View style={[styles.container, { backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}`, opacity }]}>
      <FarmCanvas
        backgroundColor={backgroundColor}
        visibleWidth={visibleWidth}
        cameraAngle={cameraAngle}
        cameraPos={cameraPos}
        modelOffsetY={modelOffsetY}
        plotsData={plotsData}
        selectedPlotIndex={selectedPlotIndex}
        onSelectPlot={onSelectPlot}
        onPressBarn={settings.canOpen ? settings.open : null}
        onPressBackground={onPressBackground}
        onSceneReady={onSceneReady}
        flashPlotIndex={flashPlotIndex}
        flashKey={flashKey}
        active={isFocused}
        blurred={blurred}
        opacity={opacity}
      />
    </View>
  );
}

function FarmCanvas({
  backgroundColor,
  visibleWidth,
  cameraAngle,
  cameraPos,
  modelOffsetY,
  plotsData,
  selectedPlotIndex,
  onSelectPlot,
  onPressBarn,
  onPressBackground,
  onSceneReady,
  flashPlotIndex,
  flashKey,
  active,
  blurred = false,
}) {
  const animationRef = useRef(null);
  const rendererRef = useRef(null);
  const renderRef = useRef(null);
  const onSceneReadyRef = useRef(onSceneReady);
  onSceneReadyRef.current = onSceneReady;
  const frameCallbacksRef = useRef(new Set());
  const sceneCleanupRef = useRef(null);
  const flashRequestRef = useRef(null);
  const playedFlashKeyRef = useRef(null);
  const mountedRef = useRef(true);
  const activeRef = useRef(active);

  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const farmModelRef = useRef(null);
  const cropsGroupRef = useRef(null);
  const pendingGroupRef = useRef(null);
  const lastCropsKeyRef = useRef(null);
  const plotMeshesRef = useRef([]);
  const borderMeshesRef = useRef([]);
  const hitMeshesRef = useRef([]);
  const plotCentersRef = useRef([]);
  const layoutRef = useRef({ width: 0, height: 0 });
  const touchStartRef = useRef(null);
  const isSceneReadyRef = useRef(false);
  const isUpdatingRef = useRef(false);
  const pendingUpdateRef = useRef(false);
  const lastPlotsSignatureRef = useRef('');

  const selectedPlotIndexRef = useRef(selectedPlotIndex);
  const onSelectPlotRef = useRef(onSelectPlot);
  const barnBoxRef = useRef(null);
  const barnRef = useRef(null);
  const plotsDataRef = useRef(plotsData);

  useEffect(() => { selectedPlotIndexRef.current = selectedPlotIndex; }, [selectedPlotIndex]);
  useEffect(() => { onSelectPlotRef.current = onSelectPlot; }, [onSelectPlot]);

  useEffect(() => {
    plotsDataRef.current = plotsData;
    const sig = JSON.stringify(
      (plotsData || []).map((p) => [
        p.plotIndex ?? p.id,
        p.cropName || '',
        p.stage ?? 1,
        p.farmStatus || '',
      ])
    );
    if (sig === lastPlotsSignatureRef.current) return;
    lastPlotsSignatureRef.current = sig;

    if (isSceneReadyRef.current && sceneRef.current && farmModelRef.current) {
      updateCrops();
    }
  }, [plotsData]);

  useEffect(() => {
    activeRef.current = active;
    if (active && animationRef.current === null && renderRef.current) {
      renderRef.current();
    }
  }, [active]);

  useEffect(() => {
    borderMeshesRef.current.forEach((mesh) => {
      const pIdx = mesh.userData.plotIndex;
      applySelectionStyleToMesh(mesh, pIdx === selectedPlotIndex);
    });
  }, [selectedPlotIndex]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      sceneCleanupRef.current?.();
      sceneCleanupRef.current = null;
      frameCallbacksRef.current.clear();
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  const playFlashIfNeeded = () => {
    const request = flashRequestRef.current;
    const scene = sceneRef.current;
    const plotCenter = request ? plotCentersRef.current[request.index] : null;
    if (!request || request.key === playedFlashKeyRef.current) return;
    if (Date.now() - request.requestedAt > 5000) return;
    if (!isSceneReadyRef.current || !scene || !plotCenter || !farmModelRef.current) return;
    playedFlashKeyRef.current = request.key;

    const farmScale = farmModelRef.current.scale.x;
    loadPlotFrame()
      .then((source) => {
        if (!source || !mountedRef.current || sceneRef.current !== scene) return;

        const frame = createPlotFrame(source, plotCenter, farmScale);
        scene.add(frame.group);

        let elapsed = 0;
        const callback = (deltaSeconds) => {
          elapsed += deltaSeconds;
          const t = Math.min(elapsed / PLOT_FLASH_SECONDS, 1);
          frame.material.opacity = Math.abs(Math.sin(t * Math.PI * 2)) * 0.9 * (1 - t * 0.3);
          if (t >= 1) {
            frameCallbacksRef.current.delete(callback);
            scene.remove(frame.group);
            frame.dispose();
          }
        };
        frameCallbacksRef.current.add(callback);
      })
      .catch((error) => console.log('밭 반짝임: 테두리 불러오기 실패:', error?.message));
  };

  useEffect(() => {
    if (flashPlotIndex === undefined || flashPlotIndex === null || !flashKey) return;
    flashRequestRef.current = { index: flashPlotIndex, key: flashKey, requestedAt: Date.now() };
    playFlashIfNeeded();
  }, [flashKey]);

  const updateCrops = async () => {
    if (isUpdatingRef.current) {
      pendingUpdateRef.current = true;
      return;
    }
    isUpdatingRef.current = true;

    try {
      if (!sceneRef.current || !farmModelRef.current || !mountedRef.current) return;

      const cropsKey = (plotsDataRef.current || [])
        .map((plot) => {
          const pIndex = plot.plotIndex !== undefined ? plot.plotIndex : plot.id;
          return `${pIndex}:${plot.farmStatus}:${plot.cropName}:${plot.stage ?? 1}`;
        })
        .join('|');
      if (cropsKey === lastCropsKeyRef.current) return;

      const cropsScene = await loadCropsModel();
      if (!mountedRef.current || !sceneRef.current || !farmModelRef.current) return;

      const nextGroup = new THREE.Group();
      const currentPlots = plotsDataRef.current;

      if (currentPlots && currentPlots.length > 0) {
        currentPlots.forEach((plot) => {
          const pIndex = plot.plotIndex !== undefined ? plot.plotIndex : plot.id;
          const { cropName, stage = 1, farmStatus } = plot;

          if (farmStatus !== 'empty' && cropName) {
            const targetKey = resolveCropMeshKey(cropName, stage);
            const targetNodeName = CROP_MESH_MAP[targetKey];
            const plotCenter = plotCentersRef.current[pIndex];

            if (targetNodeName && plotCenter) {
              // Group 노드(예: cartoon_vegetables_3d_model009, 012)와 단일 Mesh 노드 모두 지원
              const targetObj =
                cropsScene.getObjectByName(targetNodeName) ??
                cropsScene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(targetNodeName));

              if (targetObj) {
                const clonedObj = targetObj.clone();
                // 로컬 기준 정렬을 위해 루트 위치/회전 초기화 후 월드 매트릭스 계산
                clonedObj.position.set(0, 0, 0);
                clonedObj.updateMatrixWorld(true);

                const box = new THREE.Box3().setFromObject(clonedObj);
                if (!box.isEmpty()) {
                  const isSeed = Number(stage || 1) <= 1;
                  const cropSize = new THREE.Vector3();
                  const center = new THREE.Vector3();
                  box.getSize(cropSize);
                  box.getCenter(center);

                  const footprint = Math.max(cropSize.x, cropSize.z) || 1;
                  const ratio = isSeed ? CROP_SEED_RATIO : CROP_PLANT_RATIO;
                  const sinkRatio = isSeed ? CROP_SEED_SINK_RATIO : CROP_SINK_RATIO;

                  const pivot = new THREE.Group();
                  pivot.position.set(
                    plotCenter.x,
                    plotCenter.y - plotCenter.width * sinkRatio,
                    plotCenter.z
                  );
                  pivot.scale.setScalar((plotCenter.width * ratio) / footprint);

                  clonedObj.position.set(-center.x, -box.min.y, -center.z);
                  pivot.add(clonedObj);
                  nextGroup.add(pivot);
                }
              }
            }
          }
        });
      }

      if (!mountedRef.current || !sceneRef.current) return;

      lastCropsKeyRef.current = cropsKey;
      pendingGroupRef.current = nextGroup;
    } catch (err) {
      console.log('❌ updateCrops 에러:', err?.message);
    } finally {
      isUpdatingRef.current = false;
      if (pendingUpdateRef.current && mountedRef.current) {
        pendingUpdateRef.current = false;
        updateCrops();
      }
    }
  };

  const onContextCreate = async (gl) => {
    try {
      isSceneReadyRef.current = false;
      lastCropsKeyRef.current = null;
      cropsGroupRef.current = null;
      pendingGroupRef.current = null;
      sceneCleanupRef.current?.();
      sceneCleanupRef.current = null;
      frameCallbacksRef.current.clear();
      playedFlashKeyRef.current = null;
      hitMeshesRef.current = [];
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      if (width === 0 || height === 0) return;

      const renderer = new Renderer({ gl, alpha: false, antialias: true });
      rendererRef.current = renderer;
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      renderer.setClearColor(backgroundColor, 1);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.8;

      gl.viewport(0, 0, width, height);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
      if (cameraPos && cameraPos.length >= 3) {
        camera.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
      } else if (visibleWidth) {
        const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
        const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
        const distance = visibleWidth / 2 / Math.tan(halfH);
        const angle = THREE.MathUtils.degToRad(cameraAngle);
        camera.position.set(0, distance * Math.sin(angle), distance * Math.cos(angle));
      } else {
        camera.position.set(0, 5, 8);
      }
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const light = new THREE.DirectionalLight(0xffffff, 0.7);
      light.position.set(5, 10, 7);
      scene.add(light);

      const farmModel = await loadFarmModel();
      if (!mountedRef.current) return;
      const clonedFarm = farmModel.clone();
      if (modelOffsetY) clonedFarm.position.y += modelOffsetY;
      clonedFarm.updateMatrixWorld(true);
      scene.add(clonedFarm);
      farmModelRef.current = clonedFarm;

      const barn =
        clonedFarm.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(BARN_NODE_NAME)) ??
        clonedFarm.getObjectByName(BARN_NODE_NAME);
      if (!barn) console.log('창고 오브젝트를 찾지 못했어요:', BARN_NODE_NAME);
      barnRef.current = barn ?? null;
      barnBoxRef.current = barn
        ? new THREE.Box3().setFromObject(barn).expandByScalar(BARN_HIT_PADDING)
        : null;

      const plotMeshes = [];
      const borderMeshes = [];
      clonedFarm.traverse((child) => {
        if (child.isMesh) {
          const targetName = child.name || child.parent?.name || '';
          const plotMatch = targetName.match(/plot_(\d+)/i);
          if (plotMatch) {
            child.userData.plotIndex = parseInt(plotMatch[1], 10);
            plotMeshes.push(child);
            return;
          }

          const borderMatch = targetName.match(/border_(\d+)/i);
          if (borderMatch) {
            child.userData.plotIndex = parseInt(borderMatch[1], 10);
            borderMeshes.push(child);
          }
        }
      });
      plotMeshesRef.current = plotMeshes;
      borderMeshesRef.current = borderMeshes;

      const plotCenters = [];
      const hitMeshes = [];
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });

      for (let i = 0; i < 12; i++) {
        const pMesh = plotMeshes.find((m) => m.userData.plotIndex === i);
        const bMesh = borderMeshes.find((m) => m.userData.plotIndex === i);
        if (!pMesh && !bMesh) continue;

        const combinedBox = new THREE.Box3();
        if (pMesh) {
          pMesh.updateMatrixWorld(true);
          combinedBox.union(new THREE.Box3().setFromObject(pMesh));
        }
        if (bMesh) {
          bMesh.updateMatrixWorld(true);
          combinedBox.union(new THREE.Box3().setFromObject(bMesh));
        }

        const c = new THREE.Vector3();
        const size = new THREE.Vector3();
        combinedBox.getCenter(c);
        combinedBox.getSize(size);

        const cellWidth = Math.max(size.x, size.z, 0.4);
        plotCenters[i] = {
          x: c.x,
          y: combinedBox.max.y,
          z: c.z,
          width: Math.min(size.x, size.z) || cellWidth,
          touchRadius: (cellWidth * 0.5) * PLOT_TOUCH_RADIUS_RATIO,
        };

        const boxW = Math.max(size.x * 1.35, 0.55);
        const boxD = Math.max(size.z * 1.35, 0.55);
        const boxH = Math.max(size.y, 0.4);
        const hitGeo = new THREE.BoxGeometry(boxW, boxH, boxD);
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.position.set(c.x, c.y, c.z);
        hitMesh.userData = { plotIndex: i };
        scene.add(hitMesh);
        hitMeshes.push(hitMesh);
      }

      plotCentersRef.current = plotCenters;
      hitMeshesRef.current = hitMeshes;

      await updateCrops();
      if (!mountedRef.current) return;
      if (pendingGroupRef.current) {
        const nextGroup = pendingGroupRef.current;
        pendingGroupRef.current = null;
        cropsGroupRef.current = nextGroup;
        scene.add(nextGroup);
      }
      isSceneReadyRef.current = true;
      updateCrops();

      if (onSceneReadyRef.current) {
        const cleanup = onSceneReadyRef.current({
          scene,
          farm: clonedFarm,
          plotCenters: plotCentersRef.current,
          addFrameCallback: (callback) => {
            frameCallbacksRef.current.add(callback);
            return () => frameCallbacksRef.current.delete(callback);
          },
        });
        sceneCleanupRef.current = typeof cleanup === 'function' ? cleanup : null;
      }

      playFlashIfNeeded();

      const currentSelected = selectedPlotIndexRef.current;
      if (currentSelected !== null && currentSelected !== undefined) {
        borderMeshes.forEach((mesh) => {
          const pIdx = mesh.userData.plotIndex;
          if (pIdx === currentSelected) {
            applySelectionStyleToMesh(mesh, true);
          }
        });
      }

      let lastRenderTime = 0;
      const render = (now = 0) => {
        if (!mountedRef.current || !activeRef.current) {
          animationRef.current = null;
          return;
        }
        animationRef.current = requestAnimationFrame(render);
        if (now - lastRenderTime < 32) return;
        const deltaSeconds = lastRenderTime ? Math.min((now - lastRenderTime) / 1000, 0.1) : 0;
        lastRenderTime = now;
        try {
          if (pendingGroupRef.current && sceneRef.current) {
            const nextGroup = pendingGroupRef.current;
            pendingGroupRef.current = null;
            const prevGroup = cropsGroupRef.current;
            cropsGroupRef.current = nextGroup;
            sceneRef.current.add(nextGroup);
            if (prevGroup) sceneRef.current.remove(prevGroup);
          }
          frameCallbacksRef.current.forEach((callback) => callback(deltaSeconds));
          renderer.render(scene, camera);
          gl.endFrameEXP();
        } catch (renderErr) {
          console.log('❌ 렌더 프레임 에러:', renderErr?.message);
        }
      };
      renderRef.current = render;
      render();
    } catch (error) {
      console.log('❌ 농장 3D 모델 로딩 실패:', error?.message);
    }
  };

  return (
    <View
      style={[styles.glView, blurred && styles.blurredView]}
      onLayout={(e) => { layoutRef.current = e.nativeEvent.layout; }}
      onStartShouldSetResponder={() => !!(onSelectPlot || onPressBarn || onPressBackground)}
      onResponderGrant={(e) => {
        touchStartRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, time: Date.now() };
      }}
      onResponderRelease={(e) => {
        if (!touchStartRef.current) return;
        const { locationX, locationY } = e.nativeEvent;
        const camera = cameraRef.current;
        const hitMeshes = hitMeshesRef.current;
        const plotCenters = plotCentersRef.current;
        const { width, height } = layoutRef.current;

        if (!camera || !width || !height) {
          onPressBackground?.();
          return;
        }

        const mouse = new THREE.Vector2((locationX / width) * 2 - 1, -(locationY / height) * 2 + 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        const barnHit = onPressBarn && barnRef.current
          ? raycaster.intersectObject(barnRef.current, true)[0]
          : null;
        const plotHit = onSelectPlotRef.current
          ? raycaster.intersectObjects([...plotMeshesRef.current, ...borderMeshesRef.current], false)[0]
          : null;

        if (barnHit && (!plotHit || barnHit.distance < plotHit.distance)) {
          onPressBarn();
          return;
        }
        if (plotHit && typeof plotHit.object.userData?.plotIndex === 'number') {
          onSelectPlotRef.current(plotHit.object.userData.plotIndex);
          return;
        }

        if (onSelectPlotRef.current) {
          if (hitMeshes.length > 0) {
            const hits = raycaster.intersectObjects(hitMeshes, false);
            if (hits.length > 0) {
              const pIdx = hits[0].object.userData?.plotIndex;
              if (typeof pIdx === 'number') {
                onSelectPlotRef.current(pIdx);
                return;
              }
            }
          }
        }

        if (onPressBarn && barnBoxRef.current && raycaster.ray.intersectsBox(barnBoxRef.current)) {
          onPressBarn();
          return;
        }

        if (onSelectPlotRef.current) {
          const validCenters = plotCenters.filter(Boolean);
          if (validCenters.length > 0) {
            const avgY = validCenters.reduce((acc, item) => acc + item.y, 0) / validCenters.length;
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -avgY);
            const hitPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
              let bestIdx = -1;
              let bestDistSq = Infinity;
              plotCenters.forEach((center, idx) => {
                if (!center) return;
                const dx = hitPoint.x - center.x;
                const dz = hitPoint.z - center.z;
                const distSq = dx * dx + dz * dz;
                const radius = (center.touchRadius || 0.5) * 1.25;
                if (distSq <= radius * radius && distSq < bestDistSq) {
                  bestDistSq = distSq;
                  bestIdx = idx;
                }
              });
              if (bestIdx !== -1) {
                onSelectPlotRef.current(bestIdx);
                return;
              }
            }
          }
        }

        onPressBackground?.();
      }}
    >
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', backgroundColor: '#F5F1E8' },
  glView: { width: '100%', height: '100%' },
  blurredView: { filter: 'blur(8px)' },
});