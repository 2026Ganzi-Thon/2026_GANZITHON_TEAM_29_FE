import { THREE } from 'expo-three';

import { loadExtraModel } from './FarmScene3D';

// S11 물 주며 쉬기: 방금 수확한 밭에 물뿌리개가 물을 주는 연출 (작물 성장·기록에는 영향 없음)
// <FarmScene3D onSceneReady={createWatering(plotIndex)} /> 처럼 씀

const CAN_NAME = 'blue watering can 3d model';
const WATER_NAME = 'blue watering can 3d model_water';

// props.glb 원본 좌표 기준 물줄기 아래 끝(흙에 닿는 곳)과 위 끝(물뿌리개 주둥이) 높이
const STREAM_BOTTOM = new THREE.Vector3(0.045, 0.1885, -0.0326);
const STREAM_TOP_Y = 0.2421;
const STREAM_LENGTH = STREAM_TOP_Y - STREAM_BOTTOM.y;

// 물 주기 → 잠깐 들어 올리기를 반복
const POUR_SECONDS = 2.4;
const REST_SECONDS = 0.8;
const CYCLE_SECONDS = POUR_SECONDS + REST_SECONDS;
// 물줄기가 켜지고 꺼지는 시간
const FLOW_FADE_SECONDS = 0.2;
// 쉴 때 들어 올리는 높이, 물 줄 때 좌우로 움직이는 폭 (밭 한 칸 너비 대비)
const LIFT_RATIO = 0.15;
const SWAY_RATIO = 0.15;
// 어느 밭인지 모를 때(예: S12에서 바로 온 경우) 쓸 밭
const DEFAULT_PLOT_INDEX = 5;

// 밭 크기에 비해 물뿌리개가 작아 보여서 조금 키움
const CAN_SCALE = 1.3;

// 물줄기 굵기 (원본 대비). 원본은 너무 굵어서 쏟아지는 느낌이라 가늘게
const STREAM_THICKNESS = 0.45;

const DROP_COUNT = 3;
const DROP_COLOR = 0x8fd3ff;

function findNode(root, name) {
  return root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)) ?? root.getObjectByName(name);
}

// plotIndex: 물을 줄 밭 (0 ~ 11)
export function createWatering(plotIndex) {
  return (sceneInfo) => startWatering(sceneInfo, plotIndex ?? DEFAULT_PLOT_INDEX);
}

function startWatering({ scene, farm, plotCenters, addFrameCallback }, plotIndex) {
  const target = plotCenters?.[plotIndex] ?? plotCenters?.[DEFAULT_PLOT_INDEX];
  if (!target) {
    console.log('물 주기: 밭 위치를 찾지 못했어요');
    return () => {};
  }

  let disposed = false;
  let removeFrame = null;
  const root = new THREE.Group();
  const ownedResources = [];

  loadExtraModel('props', require('../../../assets/models/props/props.glb'))
    .then((props) => {
      if (disposed) return;

      const canSource = findNode(props, CAN_NAME);
      const waterSource = findNode(props, WATER_NAME);
      if (!canSource || !waterSource) {
        console.log('물 주기: 물뿌리개 모델을 찾지 못했어요');
        return;
      }

      // 물줄기 아래 끝이 root의 원점(0, 0, 0)에 오도록 옮김
      const model = new THREE.Group();
      model.position.copy(STREAM_BOTTOM).negate();
      model.add(canSource.clone());

      // 물줄기는 주둥이(위 끝)를 기준으로 늘였다 줄였다 해야 해서 따로 묶음
      const waterPivot = new THREE.Group();
      waterPivot.position.set(STREAM_BOTTOM.x, STREAM_TOP_Y, STREAM_BOTTOM.z);
      const water = waterSource.clone();
      water.position.sub(waterPivot.position);
      waterPivot.add(water);
      model.add(waterPivot);
      root.add(model);

      // 떨어지는 물방울 + 흙에 닿을 때 퍼지는 물결
      const dropGeometry = new THREE.SphereGeometry(0.0022, 8, 6);
      const dropMaterial = new THREE.MeshBasicMaterial({ color: DROP_COLOR, transparent: true, opacity: 0.7 });
      const rippleGeometry = new THREE.RingGeometry(0.006, 0.008, 24);
      const rippleMaterial = new THREE.MeshBasicMaterial({
        color: DROP_COLOR,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      ownedResources.push(dropGeometry, dropMaterial, rippleGeometry, rippleMaterial);

      const drops = Array.from({ length: DROP_COUNT }, (_, index) => {
        const drop = new THREE.Mesh(dropGeometry, dropMaterial);
        drop.userData.offset = index / DROP_COUNT;
        drop.userData.spread = new THREE.Vector2((Math.random() - 0.5) * 0.003, (Math.random() - 0.5) * 0.003);
        root.add(drop);
        return drop;
      });

      const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.y = 0.001;
      root.add(ripple);

      // 원본 모델과 같은 비율로 농장에 맞춤
      root.scale.setScalar(farm.scale.x * CAN_SCALE);
      scene.add(root);

      let elapsed = 0;
      const plotWidth = target.width || 0.5;
      const soil = new THREE.Vector3(target.x, target.y - plotWidth * 0.08, target.z);

      const update = (deltaSeconds) => {
        elapsed += deltaSeconds;
        const cycleTime = elapsed % CYCLE_SECONDS;
        root.position.copy(soil);

        let flow = 0;
        if (cycleTime < POUR_SECONDS) {
          // 1) 물 주기: 밭 위를 좌우로 천천히 움직이며 물줄기를 켰다가 끝날 때 끔
          root.position.x += Math.sin((cycleTime / POUR_SECONDS) * Math.PI * 2) * plotWidth * SWAY_RATIO;
          flow = Math.min(1, cycleTime / FLOW_FADE_SECONDS, (POUR_SECONDS - cycleTime) / FLOW_FADE_SECONDS);
        } else {
          // 2) 잠깐 들어 올렸다 내려놓기
          const t = (cycleTime - POUR_SECONDS) / REST_SECONDS;
          root.position.y += Math.sin(Math.PI * t) * plotWidth * LIFT_RATIO;
        }

        waterPivot.visible = flow > 0.01;
        waterPivot.scale.set(STREAM_THICKNESS, Math.max(flow, 0.01), STREAM_THICKNESS);

        drops.forEach((drop) => {
          const fall = (elapsed * 1.1 + drop.userData.offset) % 1;
          drop.visible = flow > 0.5;
          drop.position.set(drop.userData.spread.x, STREAM_LENGTH * (1 - fall), drop.userData.spread.y);
        });

        const rippleTime = (elapsed * 1.2) % 1;
        ripple.scale.setScalar(1 + rippleTime * 1.8);
        rippleMaterial.opacity = flow * 0.35 * (1 - rippleTime);
      };

      removeFrame = addFrameCallback(update);
    })
    .catch((error) => console.log('물 주기: 물뿌리개 불러오기 실패:', error?.message));

  return () => {
    disposed = true;
    removeFrame?.();
    scene.remove(root);
    ownedResources.forEach((resource) => resource.dispose());
  };
}
