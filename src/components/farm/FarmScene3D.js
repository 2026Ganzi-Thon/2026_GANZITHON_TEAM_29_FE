
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GLView } from 'expo-gl';
import * as ExpoTHREE from 'expo-three';

global.THREE = global.THREE || ExpoTHREE.THREE;

export default function FarmScene3D() {
  const frameRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const onContextCreate = async (gl) => {
    try {
      const THREE = ExpoTHREE.THREE;

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(
        35,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        100
      );

      camera.position.set(2.9, 2.6, 3.5);
      camera.lookAt(0, 0, 0);

      const renderer = new ExpoTHREE.Renderer({ gl });
      renderer.setSize(
        gl.drawingBufferWidth,
        gl.drawingBufferHeight
      );
      renderer.setClearColor(0x000000, 0);

      // 조명
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(
        0xffffff,
        2
      );
      directionalLight.position.set(3, 5, 4);
      scene.add(directionalLight);

      // 실제 GLB 파일 불러오기
      const gltf = await ExpoTHREE.loadAsync(
        require('../../../assets/models/farm/farm.glb')
      );

      if (!mountedRef.current) return;

      const farmModel = gltf.scene || gltf;

      // 모델 중심 정렬
      const box = new THREE.Box3().setFromObject(farmModel);
      const center = box.getCenter(new THREE.Vector3());

      farmModel.position.sub(center);
      farmModel.scale.setScalar(1.4);

      scene.add(farmModel);

      // 렌더링
      const render = () => {
        if (!mountedRef.current) return;

        frameRef.current = requestAnimationFrame(render);

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
