/**
 * FORE Gold Particle Wave Background
 * Fixed fullscreen canvas — visible only in hero/header area.
 * Fades out as user scrolls past the hero section.
 * Brand gold #C9A96E at 0.12 opacity, 40×60 grid, sine wave animation.
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

  // Reduced base opacity for subtlety
  var BASE_OPACITY = 0.12;
  var material = new THREE.PointsMaterial({
    color: 0xC9A96E,
    size: 6,
    transparent: true,
    opacity: BASE_OPACITY,
    sizeAttenuation: true
  });

  var particles = new THREE.Points(geometry, material);
  scene.add(particles);

  var count = 0;
  var currentOpacity = BASE_OPACITY;

  // Scroll-based fade: particles visible in hero, fade out in content
  var heroHeight = window.innerHeight;
  var fadeStart = heroHeight * 0.3;
  var fadeEnd = heroHeight * 1.0;

  window.addEventListener('scroll', function () {
    var scrollY = window.scrollY;
    if (scrollY <= fadeStart) {
      currentOpacity = BASE_OPACITY;
    } else if (scrollY >= fadeEnd) {
      currentOpacity = 0;
    } else {
      currentOpacity = BASE_OPACITY * (1 - (scrollY - fadeStart) / (fadeEnd - fadeStart));
    }
  }, { passive: true });

  function animate() {
    requestAnimationFrame(animate);

    // Skip rendering when fully transparent
    if (currentOpacity <= 0.001) {
      if (renderer.domElement.style.visibility !== 'hidden') {
        renderer.domElement.style.visibility = 'hidden';
      }
      return;
    }
    if (renderer.domElement.style.visibility === 'hidden') {
      renderer.domElement.style.visibility = 'visible';
    }

    material.opacity = currentOpacity;

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
    heroHeight = window.innerHeight;
    fadeStart = heroHeight * 0.3;
    fadeEnd = heroHeight * 1.0;
  });
})();
