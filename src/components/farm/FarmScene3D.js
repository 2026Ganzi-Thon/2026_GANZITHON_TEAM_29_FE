
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { loadAsync, Renderer, THREE } from 'expo-three';

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
      }
    };
  }, []);

  const onContextCreate = async (gl) => {
    let renderer;

    try {
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;

      renderer = new Renderer({
        gl,
        alpha: true,
        antialias: true,
      });

      renderer.setPixelRatio(1);
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(
        35,
        width / height,
        0.1,
        1000
      );

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

      const gltf = await loadAsync(
        require('../../../assets/models/farm/farm.glb')
      );

      if (!mountedRef.current) return;

      const farmModel = gltf.scene || gltf;

      farmModel.updateMatrixWorld(true);

      const boundingBox = new THREE.Box3().setFromObject(
        farmModel
      );

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

      boundingBox.getCenter(center);
      boundingBox.getSize(size);

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

      camera.position.set(0, 3.2, 4.8);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

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
    ...StyleSheet.absoluteFillObject,
  },

  glView: {
    flex: 1,
  },
});
