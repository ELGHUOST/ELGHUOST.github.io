// Grab the globe container
const globeEl = document.getElementById('globe');
// Create the Globe
const globe = Globe()
  (globeEl)
  .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg') // Earth texture
  .backgroundColor('#0b1220') // matches your page background
  .pointsData([...Array(500)].map(() => ({
      lat: (Math.random() * 180) - 90, // -90 to 90
      lng: (Math.random() * 360) - 180, // -180 to 180
      size: Math.random() * 0.7,
      color: "#27ff79"
  })))
  .pointAltitude(0.01)
  .pointColor(d => d.color)
  .pointRadius(0.7);
// Rotate globe automatically
let rotationSpeed = 0.001; // adjust speed here
(function animate() {
    globe.rotation.y += rotationSpeed; // spin globe along Y-axis
    requestAnimationFrame(animate);
})();
