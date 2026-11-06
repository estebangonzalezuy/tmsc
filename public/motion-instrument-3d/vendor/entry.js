// Bundle entry for vendor/three.js. Only what app.js imports, so esbuild can
// tree-shake the rest of three. Rebuild (from a folder where three@0.186.1 is
// installed) with:
//   npx esbuild@0.25.10 entry.js --bundle --format=esm --minify --legal-comments=eof --outfile=three.js
export {
  WebGLRenderer, Scene, Color, Fog, PerspectiveCamera, HemisphereLight, DirectionalLight, Mesh, Group, Object3D,
  PlaneGeometry, MeshStandardMaterial, MeshPhysicalMaterial, ShadowMaterial, CanvasTexture, SRGBColorSpace, NeutralToneMapping,
  PCFShadowMap, NearestFilter, Raycaster, Vector2, Vector3, Quaternion, PMREMGenerator,
} from 'three';
export { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
