import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer, THREE, TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { encode } from 'base64-arraybuffer';
import { GLTFLoader } from 'three-stdlib';

global.THREE = global.THREE || THREE;

async function readLocalFile(uri) {
  try {
    const response = await fetch(uri);
    if (response.ok) return await response.arrayBuffer();
  } catch (e) {
    console.log('❌ seedbag fetch 실패:', e?.message);
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

let seedBagModelPromise = null;
async function loadSeedBagModel() {
  if (!seedBagModelPromise) {
    seedBagModelPromise = (async () => {
      const modelAsset = Asset.fromModule(require('../../../assets/models/farms/seedbag.glb'));
      await modelAsset.downloadAsync();
      const arrayBuffer = await readLocalFile(modelAsset.localUri);
      const loader = createSafeGLTFLoader('seedbag');
      const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));

      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => safeConfigureMaterial(m.clone()));
          } else if (child.material) {
            child.material = safeConfigureMaterial(child.material.clone());
          }
        }
      });

      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        model.scale.multiplyScalar(1.75 / maxDim);
      }
      model.updateMatrixWorld(true);
      return model;
    })();
  }
  return seedBagModelPromise;
}

export default function SeedBagScene3D() {
  const animationRef = useRef(null);
  const rendererRef = useRef(null);
  const mountedRef = useRef(true);

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
      if (!width || !height) return;

      const renderer = new Renderer({ gl, alpha: true, antialias: true });
      rendererRef.current = renderer;
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;

      gl.viewport(0, 0, width, height);

      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
      camera.position.set(0, 0.9, 4.15);
      camera.lookAt(0, -0.1, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.95));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
      dirLight.position.set(3, 6, 4);
      scene.add(dirLight);

      const baseModel = await loadSeedBagModel();
      if (!mountedRef.current) return;
      const bag = baseModel.clone();
      bag.position.y += 0.14;
      scene.add(bag);

      const render = () => {
        if (!mountedRef.current) return;
        animationRef.current = requestAnimationFrame(render);
        bag.rotation.y += 0.012;
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      render();
    } catch (err) {
      console.log('❌ seedbag 3D 로딩 실패:', err?.message);
    }
  };

  return (
    <View style={styles.wrap}>
      <GLView style={styles.gl} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  gl: { width: '100%', height: '100%', backgroundColor: 'transparent' },
});