import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { XRButton } from 'three/addons/webxr/XRButton.js'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

let container
let camera, scene, renderer
let controller1, controller2
let controllerGrip1, controllerGrip2
let raycaster

const intersected = []
const selectableObjects = [] // Array to store individual meshes for interaction

const bullets = [] // Array to store active bullets
const bulletSpeed = 0.1 // Speed at which bullets move

// Load firing sound
const fireSound = new Audio('laser.ogg')

let controls, group

init()

function init() {
  container = document.createElement('div')
  document.body.appendChild(container)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x808080)

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10)
  camera.position.set(0, 1.6, 3)

  controls = new OrbitControls(camera, container)
  controls.target.set(0, 1.6, 0)
  controls.update()

  const floorGeometry = new THREE.PlaneGeometry(6, 6)
  const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.25 })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  scene.add(new THREE.HemisphereLight(0xbcbcbc, 0xa5a5a5, 3))

  const ambientLight = new THREE.AmbientLight(0xffffff, 1) // Color and intensity
  scene.add(ambientLight)

  const pointLight = new THREE.PointLight(0xffffff, 4, 8)
  pointLight.position.set(0, 2, 4)
  scene.add(pointLight)

  const light = new THREE.DirectionalLight(0xffffff, 3)
  light.position.set(0, 4, 2)
  light.castShadow = true
  light.shadow.camera.top = 3
  light.shadow.camera.bottom = -3
  light.shadow.camera.right = 3
  light.shadow.camera.left = -3
  light.shadow.mapSize.set(4096, 4096)
  scene.add(light)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setAnimationLoop(animate)
  renderer.shadowMap.enabled = true
  renderer.xr.enabled = true
  container.appendChild(renderer.domElement)

  document.body.appendChild(XRButton.createButton(renderer))

  // Controllers
  controller1 = renderer.xr.getController(0)
  controller1.addEventListener('selectstart', onSelectStart)
  controller1.addEventListener('selectend', onSelectEnd)
  scene.add(controller1)

  controller2 = renderer.xr.getController(1)
  controller2.addEventListener('selectstart', onSelectStart)
  controller2.addEventListener('selectend', onSelectEnd)
  scene.add(controller2)

  const controllerModelFactory = new XRControllerModelFactory()

  controllerGrip1 = renderer.xr.getControllerGrip(0)
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
  scene.add(controllerGrip1)

  controllerGrip2 = renderer.xr.getControllerGrip(1)
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2))
  scene.add(controllerGrip2)

  group = new THREE.Group()
  scene.add(group)

  const loader = new GLTFLoader()
  loader.load('wilmshurst.glb', (gltf) => {
    const logo = gltf.scene
    logo.position.set(0, 0, -2)
    logo.scale.set(1, 1, 1)
    scene.add(logo)

    logo.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.material = child.material.clone()
        selectableObjects.push(child)
      }
    })
  })

  // Load blaster model and attach to right controller (controllerGrip2)
  loader.load('blaster.glb', (gltf) => {
    const blaster = gltf.scene
    // blaster.scale.set(0.5, 0.5, 0.5) // Scale the blaster
    controllerGrip2.add(blaster) // Attach blaster to right controller
  })

  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ])

  const line = new THREE.Line(geometry)
  line.name = 'line'
  line.scale.z = 5

  controller1.add(line.clone())
  controller2.add(line.clone())

  raycaster = new THREE.Raycaster()

  window.addEventListener('resize', onWindowResize)
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function onSelectStart(event) {
  const controller = event.target

  const intersections = getIntersections(controller)
  if (intersections.length > 0) {
    const intersection = intersections[0]
    const object = intersection.object

    object.material.emissive.b = 1 // Visual feedback for selection
    controller.attach(object) // Attach selected mesh to controller
    controller.userData.selected = object
  }
}

function onSelectEnd(event) {
  const controller = event.target

  if (controller.userData.selected !== undefined) {
    const object = controller.userData.selected

    object.material.emissive.b = 0 // Reset visual feedback
    group.attach(object) // Reattach the mesh to the scene
    controller.userData.selected = undefined
  }
}

function getIntersections(controller) {
  controller.updateMatrixWorld()
  raycaster.setFromXRController(controller)

  // Intersect with all selectable objects (individual meshes)
  return raycaster.intersectObjects(selectableObjects, false)
}
function intersectObjects(controller) {
  if (controller.userData.targetRayMode === 'screen') return
  if (controller.userData.selected !== undefined) return

  const line = controller.getObjectByName('line')
  const intersections = getIntersections(controller)

  cleanIntersected() // Reset previously highlighted objects

  if (intersections.length > 0) {
    intersections.forEach((intersection) => {
      const object = intersection.object

      if (!intersected.includes(object)) {
        object.material.emissive.set(0xff0000) // Highlight in red
        intersected.push(object)
      }
    })

    line.scale.z = intersections[0].distance // Set line length to closest intersection
  }
  else {
    line.scale.z = 5
  }
}

function cleanIntersected() {
  intersected.forEach((object) => {
    object.material.emissive.set(0x000000) // Reset emissive color
  })
  intersected.length = 0
}

function fireBullet() {
  // Play firing sound
  fireSound.play()

  // Create a small sphere to represent the bullet
  const bulletGeometry = new THREE.SphereGeometry(0.02, 8, 8)
  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial)

  // Position the bullet at the blaster's tip
  const blasterTip = new THREE.Vector3()
  controller2.getWorldPosition(blasterTip) // Get the position of the controller
  bullet.position.copy(blasterTip)

  // Set bullet direction based on controller's orientation
  const direction = new THREE.Vector3(0, 0, -1)
  direction.applyQuaternion(controller2.quaternion) // Rotate direction by controller's orientation
  bullet.userData.direction = direction

  scene.add(bullet)
  bullets.push(bullet)
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    bullet.position.add(bullet.userData.direction.clone().multiplyScalar(bulletSpeed)) // Move bullet

    // Check for collisions with letters
    const intersections = raycaster.intersectObjects(selectableObjects, false)
    if (intersections.length > 0) {
      const intersectedObject = intersections[0].object

      // Remove the intersected letter from the scene
      scene.remove(intersectedObject)
      selectableObjects.splice(selectableObjects.indexOf(intersectedObject), 1)

      // Remove bullet from scene and array
      scene.remove(bullet)
      bullets.splice(i, 1)
      continue
    }

    // Remove bullet if it goes too far
    if (bullet.position.length() > 10) {
      scene.remove(bullet)
      bullets.splice(i, 1)
    }
  }
}

controller2.addEventListener('selectstart', fireBullet)

function animate() {
  cleanIntersected()
  intersectObjects(controller1)
  intersectObjects(controller2)
  // Move bullets and check for collisions
  updateBullets()
  renderer.render(scene, camera)
}
