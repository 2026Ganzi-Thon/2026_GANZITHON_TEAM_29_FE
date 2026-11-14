import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer, THREE, TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { encode } from 'base64-arraybuffer';
import { GLTFLoader } from 'three-stdlib';

global.THREE = global.THREE || THREE;

// 💡 외부에서 카메라 위치나 모델 위치를 props로 받을 수 있게 처리
export default function FarmScene3D({
  cameraPos = [0, 5.5, 6.2], // 기본 카메라 위치
  cameraLookAt = [0, -0.2, 0], // 시선 처리
  modelOffsetY = 0.8, // 3D 모델 Y축 오프셋
}) {
  const animationRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  const onContextCreate = async (gl) => {
    let renderer;

    try {
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      if (width === 0 || height === 0) return;

      renderer = new Renderer({ gl, alpha: false, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);

      const GRASS_COLOR = 0xA8D377;
      renderer.setClearColor(GRASS_COLOR, 1);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      gl.viewport(0, 0, width, height);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(GRASS_COLOR);

      // 전달받은 카메라 위치 적용
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
      camera.position.set(...cameraPos);
      camera.lookAt(...cameraLookAt);

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(6, 12, 6);
      scene.add(directionalLight);

      const modelAsset = Asset.fromModule(
        require('../../../assets/models/farms/farm_1.glb')
      );
      await modelAsset.downloadAsync();
      if (!mountedRef.current) return;

      const response = await fetch(modelAsset.localUri);
      const arrayBuffer = await response.arrayBuffer();

      const loader = new GLTFLoader();
      const textureLoader = new TextureLoader();

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
              const extension = mimeType.split('/')[1].replace('jpeg', 'jpg');

              const textureUri = `${FileSystem.cacheDirectory}farm_texture_${sourceIndex}.${extension}`;
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

      const gltf = await new Promise((resolve, reject) => {
        loader.parse(arrayBuffer, '', resolve, reject);
      });

      if (!mountedRef.current) return;

      const farmModel = gltf.scene;
      farmModel.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.roughness = 0.7;
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
        const scale = 3.2 / maxDimension;
        farmModel.scale.multiplyScalar(scale);
      }
      
      // 전달받은 모델 Y축 오프셋 적용
      farmModel.position.y += modelOffsetY;

      scene.add(farmModel);

      const render = () => {
        if (!mountedRef.current) return;
        animationRef.current = requestAnimationFrame(render);
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      render();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', backgroundColor: '#A8D377' },
  glView: { width: '100%', height: '100%' },
});