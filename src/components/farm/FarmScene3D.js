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

global.THREE = global.THREE || THREE;

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
  if ('roughness' in mat) mat.roughness = 0.6;
  if ('metalness' in mat) mat.metalness = 0.1;
  if (mat.map) {
    mat.map.encoding = THREE.sRGBEncoding;
    mat.map.flipY = false;
  }
  return mat;
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
}) {
  const isFocused = useIsFocused();

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
  const plotMeshesRef = useRef([]);
  const plotCentersRef = useRef([]);
  const layoutRef = useRef({ width: 0, height: 0 });
  const touchStartRef = useRef(null);
  const isSceneReadyRef = useRef(false);
  const isUpdatingRef = useRef(false);
  const pendingUpdateRef = useRef(false);
  const lastPlotsSignatureRef = useRef('');

  const selectedPlotIndexRef = useRef(selectedPlotIndex);
  const onSelectPlotRef = useRef(onSelectPlot);
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
    plotMeshesRef.current.forEach((mesh) => {
      const pIdx = mesh.userData.plotIndex;
      if (!mesh.material) return;

      const applySelectionStyle = (mat) => {
        if (!mat) return;
        if (!mat.userData.originalColor) {
          mat.userData.originalColor = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);
        }

        const isSelected = pIdx === selectedPlotIndex;
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

      const cropsScene = await loadCropsModel();
      if (!mountedRef.current || !sceneRef.current || !farmModelRef.current) return;

      const nextGroup = new THREE.Group();
      const currentPlots = plotsDataRef.current;
      const farmScale = farmModelRef.current.scale.x;

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
            const plotCenter = plotCentersRef.current[pIndex];

            if (targetMeshName && plotCenter) {
              cropsScene.traverse((child) => {
                if (child.isMesh && child.name === targetMeshName && child.geometry) {
                  const pivot = new THREE.Group();
                  pivot.position.set(
                    plotCenter.x,
                    plotCenter.y + (modelOffsetY || 0) - 2.1,
                    plotCenter.z
                  );
                  pivot.scale.setScalar(farmScale * 0.85);

                  const meshNode = new THREE.Mesh(child.geometry, child.material);
                  const box = child.geometry.boundingBox;
                  if (box) {
                    const center = new THREE.Vector3();
                    box.getCenter(center);
                    meshNode.position.set(-center.x, -box.min.y, -center.z);
                  }

                  pivot.add(meshNode);
                  nextGroup.add(pivot);
                }
              });
            }
          }
        });
      }

      if (!mountedRef.current || !sceneRef.current) return;
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
      renderer.toneMappingExposure = 1.0;

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

      scene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const light = new THREE.DirectionalLight(0xffffff, 1.2);
      light.position.set(5, 10, 7);
      scene.add(light);

      const farmModel = await loadFarmModel();
      if (!mountedRef.current) return;
      const clonedFarm = farmModel.clone();
      if (modelOffsetY) clonedFarm.position.y += modelOffsetY;
      clonedFarm.updateMatrixWorld(true);
      scene.add(clonedFarm);
      farmModelRef.current = clonedFarm;

      const plotMeshes = [];
      clonedFarm.traverse((child) => {
        if (child.isMesh) {
          const match = (child.name || child.parent?.name || '').match(/plot_(\d+)/i);
          if (match) {
            child.userData.plotIndex = parseInt(match[1], 10);
            plotMeshes.push(child);
          }
        }
      });
      plotMeshesRef.current = plotMeshes;

      const plotCenters = [];
      for (let i = 0; i < 12; i++) {
        const mesh = plotMeshes.find((m) => m.userData.plotIndex === i);
        if (mesh) {
          mesh.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(mesh);
          const c = new THREE.Vector3();
          box.getCenter(c);
          plotCenters[i] = new THREE.Vector3(c.x, box.max.y, c.z);
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

      const currentSelected = selectedPlotIndexRef.current;
      if (currentSelected !== null && currentSelected !== undefined) {
        plotMeshes.forEach((mesh) => {
          const pIdx = mesh.userData.plotIndex;
          if (!mesh.material) return;
          const applyInitSelection = (mat) => {
            if (!mat) return;
            if (!mat.userData.originalColor) {
              mat.userData.originalColor = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);
            }
            if (pIdx === currentSelected) {
              if (mat.color) mat.color.setHex(0xffea75);
              if ('emissive' in mat) {
                mat.emissive = new THREE.Color(0xfbfb36);
                mat.emissiveIntensity = 0.9;
              }
            }
          };
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(applyInitSelection);
          } else {
            applyInitSelection(mesh.material);
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
            if (prevGroup) {
              sceneRef.current.remove(prevGroup);
            }
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
      onStartShouldSetResponder={() => !!onSelectPlot}
      onResponderGrant={(e) => {
        touchStartRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, time: Date.now() };
      }}
      onResponderRelease={(e) => {
        if (!onSelectPlotRef.current || !touchStartRef.current) return;
        const { locationX, locationY } = e.nativeEvent;
        const camera = cameraRef.current;
        const plotMeshes = plotMeshesRef.current;
        const { width, height } = layoutRef.current;
        if (!camera || !width || !height) return;

        const mouse = new THREE.Vector2((locationX / width) * 2 - 1, -(locationY / height) * 2 + 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        if (plotMeshes.length > 0) {
          const hits = raycaster.intersectObjects(plotMeshes, true);
          if (hits.length > 0) {
            const pIdx = hits[0].object.userData?.plotIndex ?? hits[0].object.parent?.userData?.plotIndex;
            if (pIdx !== undefined) onSelectPlotRef.current(pIdx);
          }
        }
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