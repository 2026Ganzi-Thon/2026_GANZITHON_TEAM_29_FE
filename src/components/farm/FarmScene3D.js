
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

// props (모두 선택 사항 · 안 넘기면 기존 화면(S01 등) 그대로 보임)
// - backgroundColor: 3D 배경색 (숫자 hex, 예: 0xacd066)
// - visibleWidth: 넘기면 "농장이 화면 가로를 꽉 채우는" 구도로 카메라를 맞춤 (S10~S19 디자인 구도)
//     화면 가로에 보일 농장 폭이에요. 농장 모델 전체 폭이 3.5라서, 숫자가 작을수록 확대돼요.
// - cameraAngle: visibleWidth를 쓸 때 내려다보는 각도(도). 클수록 위에서 내려다봐요.
export default function FarmScene3D({
  backgroundColor = 0xf5f1e8,
  visibleWidth,
  cameraAngle = 50,
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

      console.log('GLView 크기:', width, height);

      if (width === 0 || height === 0) {
        throw new Error(
          `GLView 크기가 올바르지 않습니다. width: ${width}, height: ${height}`
        );
      }

      renderer = new Renderer({
        gl,
        alpha: false,
        antialias: true,
      });

      renderer.setSize(width, height);
      renderer.setPixelRatio(1);

      renderer.setClearColor(backgroundColor, 1);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.8;

      gl.viewport(0, 0, width, height);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);

      const camera = new THREE.PerspectiveCamera(
        35,
        width / height,
        0.1,
        1000
      );

      if (visibleWidth) {
        // 화면 비율에 맞춰, 농장이 가로로 visibleWidth만큼 보이는 거리 계산
        const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
        const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
        const distance = visibleWidth / 2 / Math.tan(halfH);
        const angle = THREE.MathUtils.degToRad(cameraAngle);

        camera.position.set(
          0,
          distance * Math.sin(angle),
          distance * Math.cos(angle)
        );
      } else {
        camera.position.set(0, 5, 8);
      }

      camera.lookAt(0, 0, 0);

      const ambientLight = new THREE.AmbientLight(
        0xffffff,
        0.8
      );
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(
        0xffffff,
        0.7
      );

      directionalLight.position.set(5, 8, 5);
      scene.add(directionalLight);

      const modelAsset = Asset.fromModule(
        require('../../../assets/models/farms/farm_1.glb')
      );

      await modelAsset.downloadAsync();

      if (!mountedRef.current) return;

      if (!modelAsset.localUri) {
        throw new Error('GLB 파일 경로를 찾을 수 없습니다.');
      }

      // 안드로이드에서는 fetch로 기기 안의 파일(file://)을 못 읽는 경우가 있어서
      // expo-file-system의 File로 직접 읽음
      console.log('GLB 경로:', modelAsset.localUri);

      const glbFile = new File(modelAsset.localUri);
      const arrayBuffer = await glbFile.arrayBuffer();

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('GLB 파일을 읽을 수 없습니다.');
      }

      console.log('GLB 크기(byte):', arrayBuffer.byteLength);

      const loader = new GLTFLoader();
      const textureLoader = new TextureLoader();


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

      const gltf = await new Promise((resolve, reject) => {
        loader.parse(
          arrayBuffer,
          '',
          resolve,
          reject
        );
      });

      if (!mountedRef.current) return;

      const farmModel = gltf.scene;

      farmModel.updateMatrixWorld(true);

      const boundingBox = new THREE.Box3().setFromObject(
        farmModel
      );

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

      boundingBox.getCenter(center);
      boundingBox.getSize(size);

      console.log('농장 모델 중심:', center);
      console.log('농장 모델 크기:', size);

      farmModel.position.sub(center);

      const maxDimension = Math.max(
        size.x,
        size.y,
        size.z
      );

      if (maxDimension > 0) {
        const scale = 3.5 / maxDimension;
        farmModel.scale.multiplyScalar(scale);
      }

      scene.add(farmModel);

      console.log('농장 3D 모델 및 텍스처 로딩 성공');

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
    <View
      style={[
        styles.container,
        { backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}` },
      ]}
    >
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
    backgroundColor: '#F5F1E8',
  },

  glView: {
    width: '100%',
    height: '100%',
  },
});
