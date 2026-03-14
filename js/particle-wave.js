/**
 * FORE Gold Particle Wave Background
 * Fixed fullscreen canvas behind all content.
 * Brand gold #C9A96E at 0.3 opacity, 40×60 grid, sine wave animation.
 */
(function () {
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 5000);
  camera.position.set(0, 355, 1220);

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.zIndex = '-1';
  renderer.domElement.style.pointerEvents = 'none';
  document.body.prepend(renderer.domElement);

  var COLS = 40, ROWS = 60;
  var total = COLS * ROWS;
  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(total * 3);
  var separationX = 50, separationZ = 50;
  var offsetX = ((COLS - 1) * separationX) / 2;
  var offsetZ = ((ROWS - 1) * separationZ) / 2;

  var idx = 0;
  for (var iy = 0; iy < ROWS; iy++) {
    for (var ix = 0; ix < COLS; ix++) {
      positions[idx * 3] = ix * separationX - offsetX;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = iy * separationZ - offsetZ;
      idx++;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  var material = new THREE.PointsMaterial({
    color: 0xC9A96E,
    size: 6,
    transparent: true,
    opacity: 0.3,
    sizeAttenuation: true
  });

  var particles = new THREE.Points(geometry, material);
  scene.add(particles);

  var count = 0;

  function animate() {
    requestAnimationFrame(animate);
    var pos = geometry.attributes.position.array;
    var i = 0;
    for (var iy = 0; iy < ROWS; iy++) {
      for (var ix = 0; ix < COLS; ix++) {
        pos[i * 3 + 1] = Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
        i++;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    count += 0.1;
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
