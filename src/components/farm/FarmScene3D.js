import React, { useEffect, useRef } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
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

// iOS는 fetch로 읽히고, 안드로이드는 fetch로 file://을 못 읽는 경우가 있어서 File로 한 번 더 시도
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

function textureLoaderPlugin(parser) {
  const textureLoader = new TextureLoader();
  const textureCache = new Map();

  parser.loadImageSource = async (sourceIndex) => {
    if (textureCache.has(sourceIndex)) {
      return textureCache.get(sourceIndex).then((texture) => texture.clone());
    }

    const texturePromise = (async () => {
      const imageSource = parser.json.images[sourceIndex];

      if (!imageSource) {
        throw new Error(`텍스처 이미지 ${sourceIndex}를 찾을 수 없습니다.`);
      }

      if (imageSource.bufferView === undefined) {
        throw new Error(`지원하지 않는 텍스처 형식입니다: ${sourceIndex}`);
      }

      const imageBuffer = await parser.getDependency('bufferView', imageSource.bufferView);
      const mimeType = imageSource.mimeType || 'image/png';
      const extension = mimeType.split('/')[1].replace('jpeg', 'jpg');
      const textureUri = `${FileSystem.cacheDirectory}farm_texture_${sourceIndex}.${extension}`;

      await FileSystem.writeAsStringAsync(textureUri, encode(imageBuffer), {
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
}

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

  const loader = new GLTFLoader();
  loader.register(textureLoaderPlugin);

  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject);
  });

  const farmModel = gltf.scene;
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

  console.log('농장 3D 모델 및 텍스처 로딩 성공');

  return farmModel;
}

// 농장 모델은 앱 전체에서 한 번만 불러오고, 화면마다 clone해서 씀
let farmModelPromise = null;

function loadFarmModel() {
  if (!farmModelPromise) {
    farmModelPromise = parseFarmModel().catch((error) => {
      farmModelPromise = null;
      throw error;
    });
  }
  return farmModelPromise;
}

// props (모두 선택)
// - backgroundColor: 배경색 (예: 0xacd066)
// - visibleWidth: 화면 가로에 보일 농장 폭. 작을수록 확대 (안 넘기면 기존 구도)
// - cameraAngle: visibleWidth를 쓸 때 내려다보는 각도
// - onPressBackground: 창고가 아닌 곳을 눌렀을 때 실행
export default function FarmScene3D({
  backgroundColor = 0xf5f1e8,
  visibleWidth,
  cameraAngle = 50,
  onPressBackground,
}) {
  // 스택에 쌓인 뒤쪽 화면은 3D를 내려서 메모리를 아낌
  const isFocused = useIsFocused();
  const settings = useSettings();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}` },
      ]}
    >
      {isFocused && (
        <FarmCanvas
          backgroundColor={backgroundColor}
          visibleWidth={visibleWidth}
          cameraAngle={cameraAngle}
          onPressBarn={settings.canOpen ? settings.open : null}
          onPressBackground={onPressBackground}
        />
      )}
    </View>
  );
}

function FarmCanvas({ backgroundColor, visibleWidth, cameraAngle, onPressBarn, onPressBackground }) {
  const animationRef = useRef(null);
  const rendererRef = useRef(null);
  const mountedRef = useRef(true);
  const sizeRef = useRef({ width: 0, height: 0 });
  const hitRef = useRef(null); // { camera, barnBox }

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

      if (width === 0 || height === 0) {
        throw new Error(`GLView 크기가 올바르지 않습니다. width: ${width}, height: ${height}`);
      }

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

      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);

      if (visibleWidth) {
        const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
        const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
        const distance = visibleWidth / 2 / Math.tan(halfH);
        const angle = THREE.MathUtils.degToRad(cameraAngle);

        camera.position.set(0, distance * Math.sin(angle), distance * Math.cos(angle));
      } else {
        camera.position.set(0, 5, 8);
      }

      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
      directionalLight.position.set(5, 8, 5);
      scene.add(directionalLight);

      const farmModel = await loadFarmModel();

      if (!mountedRef.current) return;

      // geometry, material, texture는 원본과 공유됨
      const farm = farmModel.clone();
      scene.add(farm);
      farm.updateMatrixWorld(true);

      const barn =
        farm.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(BARN_NODE_NAME)) ??
        farm.getObjectByName(BARN_NODE_NAME);

      if (!barn) console.log('창고 오브젝트를 찾지 못했어요:', BARN_NODE_NAME);

      hitRef.current = {
        camera,
        barnBox: barn ? new THREE.Box3().setFromObject(barn).expandByScalar(BARN_HIT_PADDING) : null,
      };

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

  // 누른 위치에서 3D 공간으로 선을 쏴서 창고에 닿는지 확인
  const handlePress = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const { width, height } = sizeRef.current;
    const hit = hitRef.current;

    if (onPressBarn && hit?.barnBox && width > 0 && height > 0) {
      const pointer = new THREE.Vector2((locationX / width) * 2 - 1, -(locationY / height) * 2 + 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, hit.camera);

      if (raycaster.ray.intersectsBox(hit.barnBox)) {
        onPressBarn();
        return;
      }
    }

    onPressBackground?.();
  };

  return (
    <Pressable
      style={styles.glView}
      onPress={handlePress}
      onLayout={(event) => {
        sizeRef.current = event.nativeEvent.layout;
      }}
    >
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </Pressable>
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
