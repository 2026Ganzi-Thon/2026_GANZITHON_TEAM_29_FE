import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

const CROP_MESH_MAP = {
  '새싹채소_1': 'plant seedling 3d model.001',
  '당근_1': 'plant seedling 3d model.004',
  '토마토_1': 'plant seedling 3d model.009',
  '옥수수_1': 'plant seedling 3d model.010',
  '딸기_1': 'plant seedling 3d model.013',
  '호박_1': 'plant seedling 3d model.020',
};

function Model({ cropName, stage = 1 }) {
  const gltf = useGLTF(require('../../assets/models/Crops.glb'));
  const modelRef = useRef();

  const targetKey = `${cropName}_${stage}`;
  const targetMeshName = CROP_MESH_MAP[targetKey];

  useEffect(() => {
    if (gltf.scene) {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          if (targetMeshName && child.name === targetMeshName) {
            child.visible = true;
          } else {
            child.visible = false;
          }
        }
      });
    }
  }, [gltf, targetMeshName]);

  return (
    <group ref={modelRef}>
      <primitive object={gltf.scene} scale={1} />
    </group>
  );
}

export default function CropModel({ cropName = '당근', stage = 1 }) {
  return (
    <View style={styles.container}>
      <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Model cropName={cropName} stage={stage} />
      </Canvas>
    </View>
  );
}

useGLTF.preload(require('../../assets/models/Crops.glb'));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});