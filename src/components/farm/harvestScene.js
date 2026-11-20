import { THREE } from 'expo-three';

import { CROP_MESH_MAP, loadCropsModel } from './FarmScene3D';

// S10 수확: 수확한 밭에서 다 자란 작물이 튀어 오르며 반짝이는 연출 (1.5초)
// 튀어 오른 뒤에는 밭 위에 떠서 천천히 돌아감
// <FarmScene3D onSceneReady={createHarvestPop(plotIndex, cropName)} /> 처럼 씀

const POP_SECONDS = 1.5;
// 튀어 오르는 높이 (밭 한 칸 너비 대비)
const POP_HEIGHT_RATIO = 0.9;
// 작물 크기 (밭 한 칸 너비 대비)
const CROP_SIZE_RATIO = 0.8;
// 어느 밭인지 모를 때 쓸 밭
const DEFAULT_PLOT_INDEX = 5;

const SPARKLE_COUNT = 10;
const SPARKLE_COLOR = 0xffe066;

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function findCropObject(cropsScene, name) {
  return (
    cropsScene.getObjectByName(name) ??
    cropsScene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name))
  );
}

// 다 자란 모습(_3)을 먼저 찾고, 모델이 없으면 그 전 단계로 대신함 (S17 ripeScene.js에서도 씀)
// 토마토·옥수수처럼 여러 조각으로 된 모델도 통째로 복제
export function createGrownCrop(cropsScene, cropName) {
  for (const stage of ['3', '2', '1']) {
    const name = CROP_MESH_MAP[`${cropName}_${stage}`];
    if (!name) continue;

    const source = findCropObject(cropsScene, name);
    if (!source) continue;

    const model = source.clone();
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) continue;

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    model.position.set(-center.x, -box.min.y, -center.z);

    const holder = new THREE.Group();
    holder.add(model);
    return { holder, footprint: Math.max(size.x, size.z) || 1 };
  }
  return null;
}

// plotIndex: 수확한 밭 (0 ~ 11), cropName: 작물 이름 (예: '당근')
export function createHarvestPop(plotIndex, cropName) {
  return (sceneInfo) => startHarvestPop(sceneInfo, plotIndex ?? DEFAULT_PLOT_INDEX, cropName);
}

function startHarvestPop({ scene, plotCenters, addFrameCallback }, plotIndex, cropName) {
  const target = plotCenters?.[plotIndex] ?? plotCenters?.[DEFAULT_PLOT_INDEX];
  if (!target) {
    console.log('수확 연출: 밭 위치를 찾지 못했어요');
    return () => {};
  }

  let disposed = false;
  let removeFrame = null;
  const root = new THREE.Group();
  const ownedResources = [];

  loadCropsModel()
    .then((cropsScene) => {
      if (disposed) return;

      const grown = createGrownCrop(cropsScene, cropName);
      if (!grown) {
        console.log('수확 연출: 작물 모델을 찾지 못했어요:', cropName);
        return;
      }

      const plotWidth = target.width || 0.5;
      const soil = new THREE.Vector3(target.x, target.y - plotWidth * 0.08, target.z);
      root.position.copy(soil);

      const crop = new THREE.Group();
      crop.add(grown.holder);
      const cropScale = (plotWidth * CROP_SIZE_RATIO) / grown.footprint;
      root.add(crop);

      // 반짝이: 작물 주변으로 퍼졌다가 사라지는 노란 점들
      const sparkleGeometry = new THREE.OctahedronGeometry(plotWidth * 0.035);
      const sparkleMaterial = new THREE.MeshBasicMaterial({
        color: SPARKLE_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      ownedResources.push(sparkleGeometry, sparkleMaterial);

      const sparkles = Array.from({ length: SPARKLE_COUNT }, (_, index) => {
        const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
        const angle = (index / SPARKLE_COUNT) * Math.PI * 2;
        sparkle.userData.direction = new THREE.Vector3(Math.cos(angle), 0.4 + Math.random() * 0.6, Math.sin(angle));
        root.add(sparkle);
        return sparkle;
      });

      scene.add(root);

      let elapsed = 0;
      const peakY = plotWidth * POP_HEIGHT_RATIO;

      const update = (deltaSeconds) => {
        elapsed += deltaSeconds;
        const t = Math.min(elapsed / POP_SECONDS, 1);

        if (t < 1) {
          // 1) 밭에서 튀어 오르며 커짐 + 한 바퀴 돌기
          crop.position.y = peakY * easeOutBack(t);
          crop.scale.setScalar(cropScale * (0.3 + 0.7 * easeOutBack(t)));
          crop.rotation.y = t * Math.PI * 2;
        } else {
          // 2) 다 튀어 오른 뒤에는 떠서 천천히 돌기
          const idle = elapsed - POP_SECONDS;
          crop.position.y = peakY + Math.sin(idle * 2) * plotWidth * 0.04;
          crop.scale.setScalar(cropScale);
          crop.rotation.y = Math.PI * 2 + idle * 0.8;
        }

        // 반짝이는 처음 1.5초 동안만 퍼지며 사라짐
        const spread = Math.min(elapsed / POP_SECONDS, 1);
        sparkleMaterial.opacity = Math.max(0, 1 - spread) * 0.9;
        sparkles.forEach((sparkle) => {
          sparkle.visible = spread < 1;
          sparkle.position
            .copy(sparkle.userData.direction)
            .multiplyScalar(plotWidth * (0.2 + spread * 0.7));
          sparkle.position.y += peakY * 0.6;
          sparkle.rotation.y = elapsed * 4;
        });
      };

      removeFrame = addFrameCallback(update);
    })
    .catch((error) => console.log('수확 연출: 작물 불러오기 실패:', error?.message));

  return () => {
    disposed = true;
    removeFrame?.();
    scene.remove(root);
    ownedResources.forEach((resource) => resource.dispose());
  };
}
