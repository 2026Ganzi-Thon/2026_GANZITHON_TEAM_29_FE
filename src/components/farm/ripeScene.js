import { THREE } from 'expo-three';

import { createPlotFrame, loadCropsModel, loadPlotFrame } from './FarmScene3D';
import { findGrownCropMesh } from './harvestScene';

// S17 수확 확인: 다 자란 밭을 보여주는 연출
// - 밭 위에 다 자란 작물을 세우고, 노란 테두리가 은은하게 깜빡이고, 작물 주변이 반짝임
// <FarmScene3D onSceneReady={createRipeShowcase(plotIndex, cropName)} /> 처럼 씀

// 작물 크기 (밭 한 칸 너비 대비)
const CROP_SIZE_RATIO = 0.75;
// 어느 밭인지 모를 때 쓸 밭
const DEFAULT_PLOT_INDEX = 5;

const SPARKLE_COUNT = 6;
const SPARKLE_COLOR = 0xffe066;

// plotIndex: 다 자란 밭 (0 ~ 11), cropName: 작물 이름 (예: '당근')
export function createRipeShowcase(plotIndex, cropName) {
  return (sceneInfo) => startRipeShowcase(sceneInfo, plotIndex ?? DEFAULT_PLOT_INDEX, cropName);
}

function startRipeShowcase({ scene, farm, plotCenters, addFrameCallback }, plotIndex, cropName) {
  const target = plotCenters?.[plotIndex] ?? plotCenters?.[DEFAULT_PLOT_INDEX];
  if (!target) {
    console.log('다 자란 밭: 밭 위치를 찾지 못했어요');
    return () => {};
  }

  let disposed = false;
  let removeFrame = null;
  const root = new THREE.Group();
  const ownedResources = [];

  Promise.all([loadCropsModel(), loadPlotFrame()])
    .then(([cropsScene, frameSource]) => {
      if (disposed) return;

      const plotWidth = target.width || 0.5;

      // 1) 노란 테두리
      let frame = null;
      if (frameSource) {
        frame = createPlotFrame(frameSource, target, farm.scale.x);
        ownedResources.push(frame);
        root.add(frame.group);
      }

      // 2) 다 자란 작물 (geometry는 원본과 공유)
      const crop = new THREE.Group();
      const source = findGrownCropMesh(cropsScene, cropName);
      if (source) {
        const box = source.geometry.boundingBox ?? (source.geometry.computeBoundingBox(), source.geometry.boundingBox);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const cropMesh = new THREE.Mesh(source.geometry, source.material);
        cropMesh.position.set(-center.x, -box.min.y, -center.z);
        crop.add(cropMesh);
        crop.position.set(target.x, target.y - plotWidth * 0.08, target.z);
        crop.scale.setScalar((plotWidth * CROP_SIZE_RATIO) / (Math.max(size.x, size.z) || 1));
        root.add(crop);
      } else {
        console.log('다 자란 밭: 작물 모델을 찾지 못했어요:', cropName);
      }
      const cropScale = crop.scale.x;

      // 3) 작물 주변 반짝이
      const sparkleGeometry = new THREE.OctahedronGeometry(plotWidth * 0.03);
      ownedResources.push(sparkleGeometry);
      const sparkles = Array.from({ length: SPARKLE_COUNT }, (_, index) => {
        const material = new THREE.MeshBasicMaterial({
          color: SPARKLE_COLOR,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        ownedResources.push(material);
        const sparkle = new THREE.Mesh(sparkleGeometry, material);
        const angle = (index / SPARKLE_COUNT) * Math.PI * 2;
        sparkle.position.set(
          target.x + Math.cos(angle) * plotWidth * 0.42,
          target.y + plotWidth * (0.25 + (index % 3) * 0.15),
          target.z + Math.sin(angle) * plotWidth * 0.42
        );
        sparkle.userData.phase = index * 1.3;
        root.add(sparkle);
        return sparkle;
      });

      scene.add(root);

      let elapsed = 0;
      const update = (deltaSeconds) => {
        elapsed += deltaSeconds;

        if (frame) frame.material.opacity = 0.45 + Math.sin(elapsed * 3) * 0.3;

        // 작물이 살짝 숨 쉬듯 커졌다 작아지고 좌우로 흔들림
        crop.scale.setScalar(cropScale * (1 + Math.sin(elapsed * 2.5) * 0.03));
        crop.rotation.z = Math.sin(elapsed * 1.5) * 0.05;

        sparkles.forEach((sparkle) => {
          const twinkle = Math.sin(elapsed * 3 + sparkle.userData.phase);
          sparkle.material.opacity = Math.max(0, twinkle) * 0.9;
          sparkle.rotation.y = elapsed * 2;
        });
      };

      removeFrame = addFrameCallback(update);
    })
    .catch((error) => console.log('다 자란 밭: 모델 불러오기 실패:', error?.message));

  return () => {
    disposed = true;
    removeFrame?.();
    scene.remove(root);
    ownedResources.forEach((resource) => resource.dispose());
  };
}
