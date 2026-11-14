
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer, THREE, TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { encode } from 'base64-arraybuffer';
import { GLTFLoader } from 'three-stdlib';

global.THREE = global.THREE || THREE;

export default function FarmScene3D() {
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

      console.log('GLView 크기:', width, height);

      if (width === 0 || height === 0) {
        throw new Error(
          `GLView 크기가 올바르지 않습니다. width: ${width}, height: ${height}`
        );
      }

      // Renderer
      renderer = new Renderer({
        gl,
        alpha: false,
        antialias: true,
      });

      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0xeeeeee, 1);

      gl.viewport(0, 0, width, height);

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xeeeeee);

      // Camera
      const camera = new THREE.PerspectiveCamera(
        35,
        width / height,
        0.1,
        1000
      );

      camera.position.set(0, 5, 8);
      camera.lookAt(0, 0, 0);

      // Lights
      const ambientLight = new THREE.AmbientLight(
        0xffffff,
        1.5
      );
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(
        0xffffff,
        2
      );
      directionalLight.position.set(5, 10, 7);
      scene.add(directionalLight);

      // 테스트 큐브
      const testCube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
        })
      );

      scene.add(testCube);

      // 초기 렌더링
      renderer.render(scene, camera);
      gl.endFrameEXP();

      console.log('초기 테스트 큐브 렌더링 완료');

      // GLB 파일 불러오기
      const modelAsset = Asset.fromModule(
        require('../../../assets/models/farms/farm_1.glb')
      );

      await modelAsset.downloadAsync();

      if (!mountedRef.current) return;

      if (!modelAsset.localUri) {
        throw new Error('GLB 파일 경로를 찾을 수 없습니다.');
      }

      const response = await fetch(modelAsset.localUri);

      if (!response.ok) {
        throw new Error('GLB 파일을 읽을 수 없습니다.');
      }

      const arrayBuffer = await response.arrayBuffer();

      // GLTF Loader
      const loader = new GLTFLoader();
      const textureLoader = new TextureLoader();

      // React Native 텍스처 로딩 처리
      loader.register((parser) => {
        const textureCache = new Map();

        parser.loadImageSource = async (sourceIndex) => {
          if (textureCache.has(sourceIndex)) {
            return textureCache.get(sourceIndex).then(
              (texture) => texture.clone()
            );
          }

          const texturePromise = (async () => {
            const imageSource = parser.json.images[sourceIndex];

            if (!imageSource) {
              throw new Error(
                `텍스처 이미지 ${sourceIndex}를 찾을 수 없습니다.`
              );
            }

            if (imageSource.bufferView !== undefined) {
              const imageBuffer = await parser.getDependency(
                'bufferView',
                imageSource.bufferView
              );

              const base64Data = encode(imageBuffer);
              const mimeType = imageSource.mimeType || 'image/png';

              const extension = mimeType
                .split('/')[1]
                .replace('jpeg', 'jpg');

              const textureUri =
                `${FileSystem.cacheDirectory}` +
                `farm_texture_${sourceIndex}.${extension}`;

              await FileSystem.writeAsStringAsync(
                textureUri,
                base64Data,
                {
                  encoding: FileSystem.EncodingType.Base64,
                }
              );

              if (!mountedRef.current) {
                throw new Error('화면이 종료되었습니다.');
              }

              const texture = await new Promise(
                (resolve, reject) => {
                  textureLoader.load(
                    textureUri,
                    resolve,
                    undefined,
                    reject
                  );
                }
              );

              texture.flipY = false;
              texture.encoding = THREE.sRGBEncoding;

              return texture;
            }

            throw new Error(
              `지원하지 않는 텍스처 형식입니다: ${sourceIndex}`
            );
          })();

          textureCache.set(sourceIndex, texturePromise);

          return texturePromise;
        };

        return {
          name: 'RNTextureLoader',
        };
      });

      // GLB 파싱
      const gltf = await new Promise((resolve, reject) => {
        loader.parse(
          arrayBuffer,
          '',
          resolve,
          reject
        );
      });

      if (!mountedRef.current) return;

      // 농장 모델
      const farmModel = gltf.scene;

      farmModel.updateMatrixWorld(true);

      // 모델 중심 및 크기 계산
      const boundingBox = new THREE.Box3().setFromObject(
        farmModel
      );

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

      boundingBox.getCenter(center);
      boundingBox.getSize(size);

      console.log('농장 모델 중심:', center);
      console.log('농장 모델 크기:', size);

      // 모델 중심을 원점으로 이동
      farmModel.position.sub(center);

      // 모델 크기 조정
      const maxDimension = Math.max(
        size.x,
        size.y,
        size.z
      );

      if (maxDimension > 0) {
        const scale = 3.5 / maxDimension;
        farmModel.scale.multiplyScalar(scale);
      }

      // 테스트 큐브 제거
      scene.remove(testCube);
      testCube.geometry.dispose();
      testCube.material.dispose();

      // 농장 모델 추가
      scene.add(farmModel);

      console.log('농장 3D 모델 및 텍스처 로딩 성공');

      // 렌더링
      const render = () => {
        if (!mountedRef.current) return;

        animationRef.current = requestAnimationFrame(render);

        renderer.render(scene, camera);
        gl.endFrameEXP();
      };

      render();

    } catch (error) {
      console.error('농장 3D 모델 로딩 실패:', error);
    }
  };

  return (
    <View style={styles.container}>
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
      />
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
    backgroundColor: '#EEEEEE',
  },

  glView: {
    width: '100%',
    height: '100%',
  },
});
