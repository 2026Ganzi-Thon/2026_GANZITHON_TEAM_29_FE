import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer, THREE, TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { encode } from 'base64-arraybuffer';
import { GLTFLoader } from 'three-stdlib';

global.THREE = global.THREE || THREE;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FarmScene3D({
  cameraPos = [0, 5.5, 6.2], 
  cameraLookAt = [0, -0.2, 0], 
  modelOffsetY = 0.8, 
  plotsData = [],       
  onSelectPlot,         
  selectedPlotIndex = null, // 💡 추가됨: 선택된 밭 인덱스
}) {
  const animationRef = useRef(null);
  const mountedRef = useRef(true);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const plotsMeshRef = useRef([]);

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

  // 💡 선택된 밭이 바뀔 때 노란색 테두리(발광) 효과 적용
  useEffect(() => {
    plotsMeshRef.current.forEach((mesh, index) => {
      if (!mesh.material) return;
      if (index === selectedPlotIndex) {
        mesh.material.emissive = new THREE.Color(0xffd700); // 노란색 빛
        mesh.material.emissiveIntensity = 0.7;
      } else {
        mesh.material.emissive = new THREE.Color(0x000000);
        mesh.material.emissiveIntensity = 0;
      }
      mesh.material.needsUpdate = true;
    });
  }, [selectedPlotIndex]);

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
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
      camera.position.set(...cameraPos);
      camera.lookAt(...cameraLookAt);
      cameraRef.current = camera;

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(6, 12, 6);
      scene.add(directionalLight);

      const modelAsset = Asset.fromModule(
        require('../../../assets/3d/farm_base.glb')
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
      
      plotsMeshRef.current = [];
      farmModel.traverse((child) => {
        if (child.isMesh) {
          if (child.material) {
            child.material.roughness = 0.7;
            child.material.needsUpdate = true;
          }
          if (child.name && child.name.toLowerCase().includes('plot')) {
            plotsMeshRef.current.push(child);
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
        const scale = 3.2 / maxDimension;
        farmModel.scale.multiplyScalar(scale);
      }
      
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

  const handleTouch = (event) => {
    if (!cameraRef.current || !sceneRef.current || !onSelectPlot) return;

    const { nativeEvent } = event;
    const x = nativeEvent.locationX;
    const y = nativeEvent.locationY;

    mouseRef.current.x = (x / SCREEN_WIDTH) * 2 - 1;
    mouseRef.current.y = -(y / SCREEN_HEIGHT) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(plotsMeshRef.current, true);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const index = plotsMeshRef.current.indexOf(hitMesh);
      if (index !== -1) {
        onSelectPlot(index);
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleTouch}>
      <View style={styles.container}>
        <GLView style={styles.glView} onContextCreate={onContextCreate} />
      </View>
    </TouchableWithoutFeedback>
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
    backgroundColor: '#A8D377' 
  },
  glView: { 
    width: '100%', 
    height: '100%' 
  },
});