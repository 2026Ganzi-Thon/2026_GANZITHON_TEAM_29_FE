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

const CROP_MODEL_BY_NAME = {
  '새싹채소': 'cartoon_vegetables_3d_model001',
  '당근': 'cartoon_vegetables_3d_model002',
  '딸기': 'cartoon_vegetables_3d_model003',
  '호박': 'cartoon_vegetables_3d_model004',
  '토마토': 'cartoon_vegetables_3d_model005',
  '옥수수': 'cartoon_vegetables_3d_model006',
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

let cropsModelCachePromise = null;
async function loadCropsSceneOnce() {
  if (!cropsModelCachePromise) {
    cropsModelCachePromise = (async () => {
      const cropAsset = Asset.fromModule(require('../../../assets/models/farms/crops.glb'));
      await cropAsset.downloadAsync();
      const cropBuffer = await readLocalFile(cropAsset.localUri);
      const cropLoader = createSafeGLTFLoader('crop_icon');
      const cropGltf = await new Promise((resolve, reject) =>
        cropLoader.parse(cropBuffer, '', resolve, reject)
      );

      cropGltf.scene.traverse((child) => {
        if (child.isMesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              if (m?.map) {
                m.map.encoding = THREE.sRGBEncoding;
                m.map.flipY = false;
              }
            });
          } else if (child.material?.map) {
            child.material.map.encoding = THREE.sRGBEncoding;
            child.material.map.flipY = false;
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
  return cropsModelCachePromise;
}

export default function CropPreview3D({
  cropName,
  backgroundColor = 'transparent',
  style,
}) {
  const isFocused = useIsFocused();
  const mountedRef = useRef(true);
  const activeRef = useRef(isFocused);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const glRef = useRef(null);
  const currentObjectRef = useRef(null);
  const cropNameRef = useRef(cropName);

  useEffect(() => {
    activeRef.current = isFocused;
    if (isFocused) {
      renderFrame();
    }
  }, [isFocused]);

  useEffect(() => {
    cropNameRef.current = cropName;
    if (sceneRef.current) {
      updateCropObject(cropName);
    }
  }, [cropName]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  const renderFrame = () => {
    if (!mountedRef.current || !activeRef.current) return;
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !glRef.current) return;
    try {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      glRef.current.endFrameEXP();
    } catch (e) {
      console.log('❌ CropPreview3D 렌더 에러:', e?.message);
    }
  };

  const updateCropObject = async (targetCropName) => {
    if (!sceneRef.current || !mountedRef.current) return;
    try {
      const cropsScene = await loadCropsSceneOnce();
      if (!sceneRef.current || !mountedRef.current) return;

      if (currentObjectRef.current) {
        sceneRef.current.remove(currentObjectRef.current);
        currentObjectRef.current = null;
      }

      const targetMeshName = CROP_MODEL_BY_NAME[targetCropName];
      if (!targetMeshName) return;

      let found = null;
      cropsScene.traverse((child) => {
        if (!found && child.isMesh && child.name === targetMeshName) {
          found = child;
        }
      });

      if (!found) {
        console.log('❌ 메쉬 못 찾음:', targetMeshName);
        return;
      }

      const cloned = new THREE.Mesh(found.geometry, found.material);
      cloned.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(cloned);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 1.6 / maxDim;

      const holder = new THREE.Group();
      cloned.scale.multiplyScalar(scale);
      cloned.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      );

      holder.add(cloned);
      holder.updateMatrixWorld(true);
      sceneRef.current.add(holder);
      currentObjectRef.current = holder;

      if (cameraRef.current) {
        const fittedBox = new THREE.Box3().setFromObject(holder);
        const fittedSize = new THREE.Vector3();
        fittedBox.getSize(fittedSize);
        const radius = Math.max(fittedSize.x, fittedSize.y, fittedSize.z) * 0.5 || 0.8;
        const fovRad = THREE.MathUtils.degToRad(cameraRef.current.fov || 35);
        const dist = (radius / Math.sin(fovRad / 2)) * 1.15;

        cameraRef.current.position.set(0, dist * 0.35, dist);
        cameraRef.current.lookAt(0, 0, 0);
        cameraRef.current.updateProjectionMatrix();
      }

      renderFrame();
      setTimeout(renderFrame, 100);
    } catch (err) {
      console.log('❌ CropPreview3D 로딩 실패:', err?.message);
    }
  };

  const onContextCreate = async (gl) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (!width || !height) return;

    glRef.current = gl;

    const renderer = new Renderer({ gl, alpha: true, antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 3.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    await updateCropObject(cropNameRef.current);
  };

  return (
    <View style={[styles.wrap, { backgroundColor }, style]}>
      <GLView style={styles.gl} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 48,
    height: 48,
    overflow: 'hidden',
  },
  gl: {
    width: '100%',
    height: '100%',
  },
});