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
  '새싹채소_1': 'plant seedling 3d model.001',
  '당근_1': 'plant seedling 3d model.004',
  '토마토_1': 'plant seedling 3d model.009',
  '옥수수_1': 'plant seedling 3d model.010',
  '딸기_1': 'plant seedling 3d model.013',
  '호박_1': 'plant seedling 3d model.020',
};

async function readLocalFile(uri) {
  try {
    const response = await fetch(uri);
    if (response.ok) return await response.arrayBuffer();
  } catch (e) {
    console.log('fetch로 GLB 읽기 실패, File로 다시 시도:', e?.message);
  }

  const file = new File(uri);
  return await file.arrayBuffer();
}

// 농장 모델은 앱 전체에서 한 번만 불러오고, 화면마다 clone해서 씀
let farmModelPromise = null;

async function parseFarmModel() {
  const modelAsset = Asset.fromModule(require('../../../assets/models/farms/farm_1.glb'));
  await modelAsset.downloadAsync();

  if (!modelAsset.localUri) {
    throw new Error('GLB 파일 경로를 찾을 수 없습니다.');
  }

  const arrayBuffer = await readLocalFile(modelAsset.localUri);

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('GLB 파일을 읽을 수 없습니다.');
  }

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
        if (!imageSource) throw new Error();
        if (imageSource.bufferView !== undefined) {
          const imageBuffer = await parser.getDependency('bufferView', imageSource.bufferView);
          const base64Data = encode(imageBuffer);
          const mimeType = imageSource.mimeType || 'image/png';
          const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';

          const textureUri = `${FileSystem.cacheDirectory}texture_${sourceIndex}_${Date.now()}.${extension}`;
          await FileSystem.writeAsStringAsync(textureUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const texture = await new Promise((resolve, reject) => {
            textureLoader.load(textureUri, resolve, undefined, reject);
          });
          texture.flipY = false;
          texture.encoding = THREE.sRGBEncoding;
          return texture;
        }
      })();
      textureCache.set(sourceIndex, texturePromise);
      return texturePromise;
    };
    return { name: 'RNTextureLoader' };
  });

  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject);
  });

  const farmModel = gltf.scene;

  farmModel.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.roughness = 0.6;
      child.material.metalness = 0.1;
      if (child.material.map) {
        child.material.map.encoding = THREE.sRGBEncoding;
        child.material.map.flipY = false;
      }
      child.material.needsUpdate = true;
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
  console.log('농장 3D 모델 및 텍스처 로딩 성공');

  return farmModel;
}

function loadFarmModel() {
  if (!farmModelPromise) {
    farmModelPromise = parseFarmModel().catch((error) => {
      farmModelPromise = null;
      throw error;
    });
  }
  return farmModelPromise;
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
    <View
      style={[
        styles.container,
        { backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}` },
      ]}
    >
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
  const plotMeshesRef = useRef([]);
  const plotCentersRef = useRef([]);
  const layoutRef = useRef({ width: 0, height: 0 });
  const touchStartRef = useRef(null);
  
  const selectedPlotIndexRef = useRef(selectedPlotIndex);
  const onSelectPlotRef = useRef(onSelectPlot);
  const plotsDataRef = useRef(plotsData);

  useEffect(() => {
    selectedPlotIndexRef.current = selectedPlotIndex;
  }, [selectedPlotIndex]);

  useEffect(() => {
    onSelectPlotRef.current = onSelectPlot;
  }, [onSelectPlot]);

  useEffect(() => {
    plotsDataRef.current = plotsData;
  }, [plotsData]);

  useEffect(() => {
    activeRef.current = active;
    if (active && animationRef.current === null && renderRef.current) {
      renderRef.current();
    }
  }, [active]);

  // 밭 하이라이트 상태 업데이트 (0~11 인덱스 매칭)
  useEffect(() => {
    plotMeshesRef.current.forEach((mesh) => {
      const pIdx = mesh.userData.plotIndex;
      if (!mesh.material) return;

      if (!mesh.userData.originalColor) {
        mesh.userData.originalColor = mesh.material.color.clone();
      }
      if (!mesh.userData.clonedMaterial) {
        mesh.userData.clonedMaterial = mesh.material.clone();
        mesh.material = mesh.userData.clonedMaterial;
      }

      const isSelected = (pIdx === selectedPlotIndex);

      if (isSelected) {
        mesh.material.color.setHex(0xffea75);
        mesh.material.emissive = new THREE.Color(0xfbfb36);
        mesh.material.emissiveIntensity = 0.9;
      } else {
        mesh.material.color.copy(mesh.userData.originalColor);
        mesh.material.emissive = new THREE.Color(0x000000);
        mesh.material.emissiveIntensity = 0;
      }
      mesh.material.needsUpdate = true;
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

  const onContextCreate = async (gl) => {
    try {
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

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(5, 10, 7);
      scene.add(directionalLight);

      // 1. 농장 모델 추가
      const baseFarmModel = await loadFarmModel();
      if (!mountedRef.current) return;

      const farmModel = baseFarmModel.clone();

      if (modelOffsetY) {
        farmModel.position.y += modelOffsetY;
      }
      farmModel.updateMatrixWorld(true);
      scene.add(farmModel);

      const plotMeshes = [];
      farmModel.traverse((child) => {
        if (child.isMesh) {
          const name = child.name || child.parent?.name || '';
          const match = name.match(/plot_(\d+)/i);
          if (match) {
            const idx = parseInt(match[1], 10);
            child.userData.plotIndex = idx;
            plotMeshes.push(child);
          }
        }
      });

      const plotCenters = [];
      for (let i = 0; i < 12; i++) {
        const mesh = plotMeshes.find((m) => m.userData.plotIndex === i);
        if (mesh) {
          const box = new THREE.Box3().setFromObject(mesh);
          const c = new THREE.Vector3();
          box.getCenter(c);
          plotCenters[i] = c;
        }
      }

      plotMeshesRef.current = plotMeshes;
      plotCentersRef.current = plotCenters;

      // 2. 작물 모델(crops.glb) 로드 및 배치
      try {
        const cropAsset = Asset.fromModule(require('../../../assets/models/farms/crops.glb'));
        await cropAsset.downloadAsync();
        
        if (mountedRef.current && cropAsset.localUri) {
          const cropBuffer = await readLocalFile(cropAsset.localUri);
          const textureLoader = new TextureLoader();
          const cropLoader = new GLTFLoader();
          
          cropLoader.register((parser) => {
            const textureCache = new Map();
            parser.loadImageSource = async (sourceIndex) => {
              if (textureCache.has(sourceIndex)) {
                return textureCache.get(sourceIndex).then((t) => t.clone());
              }
              const texturePromise = (async () => {
                const imageSource = parser.json.images[sourceIndex];
                if (!imageSource) throw new Error();
                if (imageSource.bufferView !== undefined) {
                  const imageBuffer = await parser.getDependency('bufferView', imageSource.bufferView);
                  const base64Data = encode(imageBuffer);
                  const mimeType = imageSource.mimeType || 'image/png';
                  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';

                  const textureUri = `${FileSystem.cacheDirectory}crop_texture_${sourceIndex}_${Date.now()}.${extension}`;
                  await FileSystem.writeAsStringAsync(textureUri, base64Data, {
                    encoding: FileSystem.EncodingType.Base64,
                  });

                  if (!mountedRef.current) throw new Error();

                  const texture = await new Promise((resolve, reject) => {
                    textureLoader.load(textureUri, resolve, undefined, reject);
                  });
                  texture.flipY = false;
                  texture.encoding = THREE.sRGBEncoding;
                  return texture;
                }
              })();
              textureCache.set(sourceIndex, texturePromise);
              return texturePromise;
            };
            return { name: 'RNTextureLoader' };
          });

          const cropGltf = await new Promise((resolve, reject) => {
            cropLoader.parse(cropBuffer, '', resolve, reject);
          });

          const cropsScene = cropGltf.scene;
          cropsScene.traverse((child) => {
            if (child.isMesh && child.material) {
              if (child.material.map) {
                child.material.map.encoding = THREE.sRGBEncoding;
                child.material.map.flipY = false;
              }
              child.material.needsUpdate = true;
            }
          });

          if (plotsDataRef.current && plotsDataRef.current.length > 0) {
            plotsDataRef.current.forEach((plot) => {
              const pIndex = plot.plotIndex !== undefined ? plot.plotIndex : plot.id;
              const { cropName, stage = 1, farmStatus } = plot;
              
              if (farmStatus !== 'empty' && cropName) {
                const targetKey = `${cropName}_${stage}`;
                const targetMeshName = CROP_MESH_MAP[targetKey];

                if (targetMeshName) {
                  cropsScene.traverse((child) => {
                    if (child.isMesh && child.name === targetMeshName) {
                      const cropClone = child.clone(true);
                      const plotCenter = plotCenters[pIndex];

                      if (plotCenter) {
                        const farmScale = farmModel.scale.x;
                        cropClone.position.set(
                          plotCenter.x,
                          plotCenter.y + (modelOffsetY || 0),
                          plotCenter.z
                        );
                        cropClone.scale.multiplyScalar(farmScale);
                        scene.add(cropClone);
                      }
                    }
                  });
                }
              }
            });
          }
        }
      } catch (cropErr) {
        console.log('작물 모델(crops.glb) 로드 실패:', cropErr?.message);
      }

      // 초기 선택된 밭 하이라이트 반영
      const currentSelected = selectedPlotIndexRef.current;
      if (currentSelected !== null && currentSelected !== undefined) {
        plotMeshes.forEach((mesh) => {
          if (mesh.userData.plotIndex === currentSelected && mesh.material) {
            if (!mesh.userData.originalColor) {
              mesh.userData.originalColor = mesh.material.color.clone();
            }
            if (!mesh.userData.clonedMaterial) {
              mesh.userData.clonedMaterial = mesh.material.clone();
              mesh.material = mesh.userData.clonedMaterial;
            }
            mesh.material.color.setHex(0xffea75);
            mesh.material.emissive = new THREE.Color(0xfbfb36);
            mesh.material.emissiveIntensity = 0.9;
            mesh.material.needsUpdate = true;
          }
        });
      }

      const render = () => {
        if (!mountedRef.current || !activeRef.current) {
          animationRef.current = null;
          return;
        }

        animationRef.current = requestAnimationFrame(render);
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };

      renderRef.current = render;
      render();
    } catch (error) {
      console.error('농장 3D 모델 로딩 실패:', error);
    }
  };

  const handleTouchStart = (evt) => {
    touchStartRef.current = {
      x: evt.nativeEvent.locationX,
      y: evt.nativeEvent.locationY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (evt) => {
    if (!onSelectPlotRef.current || !touchStartRef.current) return;
    const { locationX, locationY } = evt.nativeEvent;
    const dx = Math.abs(locationX - touchStartRef.current.x);
    const dy = Math.abs(locationY - touchStartRef.current.y);
    const dt = Date.now() - touchStartRef.current.time;

    if (dx > 18 || dy > 18 || dt > 500) return;

    const camera = cameraRef.current;
    const plotMeshes = plotMeshesRef.current;
    const { width, height } = layoutRef.current;

    if (!camera || !width || !height) return;

    const mouse = new THREE.Vector2();
    mouse.x = (locationX / width) * 2 - 1;
    mouse.y = -(locationY / height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (plotMeshes.length > 0) {
      const hits = raycaster.intersectObjects(plotMeshes, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const pIdx = hitObj.userData?.plotIndex ?? hitObj.parent?.userData?.plotIndex;
        if (pIdx !== undefined && pIdx !== null) {
          onSelectPlotRef.current(pIdx);
          return;
        }
      }
    }

    if (plotCentersRef.current.length > 0) {
      let closestIndex = -1;
      let minDistanceSq = Infinity;

      plotCentersRef.current.forEach((center, idx) => {
        if (!center) return;
        const vector = center.clone();
        vector.project(camera);

        const screenX = ((vector.x + 1) * width) / 2;
        const screenY = ((-vector.y + 1) * height) / 2;

        const distSq = (locationX - screenX) ** 2 + (locationY - screenY) ** 2;
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          closestIndex = idx;
        }
      });

      if (closestIndex !== -1 && minDistanceSq < 7000) {
        onSelectPlotRef.current(closestIndex);
      }
    }
  };

  return (
    <View
      style={styles.glView}
      onLayout={(e) => {
        layoutRef.current = e.nativeEvent.layout;
      }}
      onStartShouldSetResponder={() => !!onSelectPlot}
      onResponderGrant={handleTouchStart}
      onResponderRelease={handleTouchEnd}
    >
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F1E8',
  },
  glView: {
    width: '100%',
    height: '100%',
  },
});