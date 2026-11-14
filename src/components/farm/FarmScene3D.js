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
  selectedPlotIndex = null,
}) {
  const animationRef = useRef(null);
  const mountedRef = useRef(true);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const plotsMapRef = useRef(new Map());

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

  useEffect(() => {
    plotsMapRef.current.forEach((mesh, index) => {
      if (!mesh.material) return;

      if (!mesh.userData.clonedMaterial) {
        mesh.userData.clonedMaterial = mesh.material.clone();
        mesh.material = mesh.userData.clonedMaterial;
      }

      if (index === selectedPlotIndex) {
        mesh.material.emissive = new THREE.Color(0xffd700);
        mesh.material.emissiveIntensity = 0.8;
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
      
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15; // 💡 명도(노출)를 살짝 높여 화사하게 조절

      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      gl.viewport(0, 0, width, height);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(GRASS_COLOR);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
      camera.position.set(...cameraPos);
      camera.lookAt(...cameraLookAt);
      cameraRef.current = camera;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75); // 💡 주변광 밝기 상향
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1); // 💡 메인 태양광 밝기 상향
      directionalLight.position.set(10, 20, 10);
      directionalLight.castShadow = true;
      
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
      const d = 10;
      directionalLight.shadow.camera.left = -d;
      directionalLight.shadow.camera.right = d;
      directionalLight.shadow.camera.top = d;
      directionalLight.shadow.camera.bottom = -d;
      directionalLight.shadow.bias = -0.0005;
      scene.add(directionalLight);

      const fillLight = new THREE.DirectionalLight(0xddeeff, 0.4); // 💡 보조광도 살짝 상향
      fillLight.position.set(-10, 10, -10);
      scene.add(fillLight);

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
              texture.colorSpace = THREE.SRGBColorSpace;
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
      
      plotsMapRef.current.clear();
      farmModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            child.material.roughness = 0.6;
            child.material.metalness = 0.1;
            child.material.needsUpdate = true;
          }
          
          if (child.name && child.name.toLowerCase().startsWith('plot')) {
            const match = child.name.match(/\d+/);
            if (match) {
              const plotIndex = parseInt(match[0], 10);
              plotsMapRef.current.set(plotIndex, child);
            }
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
    
    const plotMeshes = Array.from(plotsMapRef.current.values());
    const intersects = raycasterRef.current.intersectObjects(plotMeshes, true);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      
      let foundIndex = null;
      for (let [index, mesh] of plotsMapRef.current.entries()) {
        if (mesh === hitMesh) {
          foundIndex = index;
          break;
        }
      }

      if (foundIndex !== null) {
        onSelectPlot(foundIndex);
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