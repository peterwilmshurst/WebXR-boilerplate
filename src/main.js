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

const gravity = -0.001
const intersected = []
const selectableObjects = [] // Array to store individual meshes for interaction
const fallingObjects = [] // Array to store objects that are falling

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
    fallingObjects.push({ mesh: object, velocity: 0 })
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

function applyGravity() {
  fallingObjects.forEach((entry) => {
    const object = entry.mesh
    let velocity = entry.velocity

    velocity += gravity
    object.position.y += velocity // Move object along Y axis

    if (object.position.y <= 0.1) {
      object.position.y = 0.1 // Stop object from falling through the floor
      entry.velocity = 0
    }
    else {
      entry.velocity = velocity
    }
  })
}

function cleanIntersected() {
  intersected.forEach((object) => {
    object.material.emissive.set(0x000000) // Reset emissive color
  })
  intersected.length = 0
}

function animate() {
  cleanIntersected()
  intersectObjects(controller1)
  intersectObjects(controller2)
  applyGravity()
  renderer.render(scene, camera)
}
