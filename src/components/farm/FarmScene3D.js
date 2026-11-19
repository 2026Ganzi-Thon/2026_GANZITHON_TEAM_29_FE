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
// (GLB를 불러올 때 이름의 공백·점이 바뀌므로 sanitizeNodeName으로 맞춰서 찾음)
const BARN_NODE_NAME = 'farm scene 3d model.004';
// 창고가 작아서 주변을 조금 넉넉하게 눌러도 인식되도록
const BARN_HIT_PADDING = 0.1;

// 작물 크기: 밭 한 칸 너비 대비 비율 (새싹 화분 / 자라는 작물)
const CROP_SEED_RATIO = 0.45;
const CROP_PLANT_RATIO = 0.7;
// 테두리 윗면보다 살짝 아래(흙 높이)에 놓기
const CROP_SINK_RATIO = 0.17;
const CROP_SEED_SINK_RATIO = 0.285;

const CROP_MESH_MAP = {
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
  '토마토_3': 'tripo_mesh_b431ff45009',

  '옥수수_새싹': 'cartoon_vegetables_3d_model001',
  '옥수수_1': 'plant_seedling_3d_model010',
  '옥수수_2': 'plant_seedling_3d_model011',
  '옥수수_3': 'plant_seedling_3d_model010',

  '딸기_새싹': 'cartoon_vegetables_3d_model001',
  '딸기_1': 'plant_seedling_3d_model013',
  '딸기_2': 'plant_seedling_3d_model014',
  '딸기_3': 'plant_seedling_3d_model015',

  '호박_새싹': 'cartoon_vegetables_3d_model001',
  '호박_1': 'plant_seedling_3d_model020',
  '호박_2': 'plant_seedling_3d_model019',
  '호박_3': 'plant_seedling_3d_model018',
};

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
async function loadCropsModel() {
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
      return cropGltf.scene;
    })();
  }
  return cropsModelPromise;
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
}) {
  const isFocused = useIsFocused();
  const settings = useSettings();

  return (
    <View style={[styles.container, { backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}` }]}>
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
        active={isFocused}
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
  active,
}) {
  const animationRef = useRef(null);
  const rendererRef = useRef(null);
  const renderRef = useRef(null);
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

  // 테두리(border_0~11)에만 하이라이트 적용
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
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  const updateCrops = async () => {
    if (isUpdatingRef.current) {
      pendingUpdateRef.current = true;
      return;
    }
    isUpdatingRef.current = true;

    try {
      if (!sceneRef.current || !farmModelRef.current || !mountedRef.current) return;

      // 타이머 때문에 plotsData가 매초 새로 들어와도, 작물·단계가 그대로면 다시 만들지 않음
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
            let targetKey = '';
            if (stage === 1) targetKey = `${cropName}_새싹`;
            else if (stage === 2) targetKey = `${cropName}_1`;
            else if (stage === 3) targetKey = `${cropName}_1`;
            else if (stage === 4) targetKey = `${cropName}_2`;
            else targetKey = `${cropName}_3`;

            const targetMeshName = CROP_MESH_MAP[targetKey];

            if (targetMeshName) {
              cropsScene.traverse((child) => {
                if (child.isMesh && child.name === targetMeshName && child.geometry) {
                  const box = child.geometry.boundingBox;
                  const plotCenter = plotCentersRef.current[pIndex];
                  if (!box || !plotCenter) return;

                  // 작물 모델마다 원래 크기가 달라서, 밭 한 칸 크기에 맞춰 키움
                  const cropSize = new THREE.Vector3();
                  box.getSize(cropSize);
                  const footprint = Math.max(cropSize.x, cropSize.z) || 1;
                  const ratio = stage === 1 ? CROP_SEED_RATIO : CROP_PLANT_RATIO;
                  const sinkRatio = stage === 1 ? CROP_SEED_SINK_RATIO : CROP_SINK_RATIO;

                  // 밭 흙 위에 올림 (밭 위치에는 이미 modelOffsetY가 들어 있음)
                  const pivot = new THREE.Group();
                  pivot.position.set(
                    plotCenter.x,
                    plotCenter.y - plotCenter.width * sinkRatio,
                    plotCenter.z
                  );
                  pivot.scale.setScalar((plotCenter.width * ratio) / footprint);

                  // geometry는 원본과 공유 (복사하지 않아서 지울 필요 없음)
                  const meshNode = new THREE.Mesh(child.geometry, child.material);
                  const center = new THREE.Vector3();
                  box.getCenter(center);
                  meshNode.position.set(-center.x, -box.min.y, -center.z);

                  pivot.add(meshNode);
                  nextGroup.add(pivot);
                }
              });
            }
          }
        });
      }

      if (!mountedRef.current || !sceneRef.current) return;

      lastCropsKeyRef.current = cropsKey;
      // 실제 교체는 렌더 루프에서 (그리는 도중에 장면이 바뀌지 않게)
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
      // 안드로이드는 다른 화면이 위에 올라왔다 내려가면 3D 화면을 새로 만듦
      // → 이전 장면 기준 기록을 지워야 새 장면에 작물을 다시 그림
      lastCropsKeyRef.current = null;
      cropsGroupRef.current = null;
      pendingGroupRef.current = null;
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
      barnBoxRef.current = barn
        ? new THREE.Box3().setFromObject(barn).expandByScalar(BARN_HIT_PADDING)
        : null;

      // 밭(plot_0~11): 작물 위치·크기·터치 기준 / 테두리(border_0~11): 선택 하이라이트 기준
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
      for (let i = 0; i < 12; i++) {
        const mesh = plotMeshes.find((m) => m.userData.plotIndex === i);
        if (mesh) {
          mesh.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(mesh);
          const c = new THREE.Vector3();
          box.getCenter(c);
          const size = new THREE.Vector3();
          box.getSize(size);
          // x, z: 밭 가운데 / y: 밭 윗면 / width: 밭 한 칸 크기
          plotCenters[i] = { x: c.x, y: box.max.y, z: c.z, width: Math.min(size.x, size.z) };
        }
      }
      plotCentersRef.current = plotCenters;

      await updateCrops();
      if (!mountedRef.current) return;
      if (pendingGroupRef.current) {
        const nextGroup = pendingGroupRef.current;
        pendingGroupRef.current = null;
        cropsGroupRef.current = nextGroup;
        scene.add(nextGroup);
      }
      isSceneReadyRef.current = true;
      // 준비하는 동안 plotsData가 바뀌었으면 여기서 반영 (같으면 아무것도 안 함)
      updateCrops();

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
      style={styles.glView}
      onLayout={(e) => { layoutRef.current = e.nativeEvent.layout; }}
      onStartShouldSetResponder={() => !!(onSelectPlot || onPressBarn || onPressBackground)}
      onResponderGrant={(e) => {
        touchStartRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, time: Date.now() };
      }}
      onResponderRelease={(e) => {
        if (!touchStartRef.current) return;
        const { locationX, locationY } = e.nativeEvent;
        const camera = cameraRef.current;
        const plotMeshes = plotMeshesRef.current;
        const borderMeshes = borderMeshesRef.current;
        const { width, height } = layoutRef.current;

        if (!camera || !width || !height) {
          onPressBackground?.();
          return;
        }

        const mouse = new THREE.Vector2((locationX / width) * 2 - 1, -(locationY / height) * 2 + 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // 창고 → 밭/테두리 → 나머지 순서로 확인
        if (onPressBarn && barnBoxRef.current && raycaster.ray.intersectsBox(barnBoxRef.current)) {
          onPressBarn();
          return;
        }

        const selectableMeshes = [...plotMeshes, ...borderMeshes];
        if (onSelectPlotRef.current && selectableMeshes.length > 0) {
          const hits = raycaster.intersectObjects(selectableMeshes, true);
          if (hits.length > 0) {
            const pIdx = hits[0].object.userData?.plotIndex ?? hits[0].object.parent?.userData?.plotIndex;
            if (pIdx !== undefined) {
              onSelectPlotRef.current(pIdx);
              return;
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
});