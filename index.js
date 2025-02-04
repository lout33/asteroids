import * as THREE from 'three';
import metaversefile from 'metaversefile';

const { useApp, useFrame, useInternals, useLocalPlayer, useLoaders, usePhysics, useCleanup, useActivate, useCamera } = metaversefile;
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

export default () => {
  const app = useApp();
  app.name = 'Asteroid Game';
  const { renderer, camera } = useInternals();
  const localPlayer = useLocalPlayer();
  const physics = usePhysics();
  let physicsIds = [];
  let movingSoundAsteroids = [];

  const localVector = new THREE.Vector3();
  const localVector2 = new THREE.Vector3();
  const localEuler = new THREE.Euler();
  const localQuaternion = new THREE.Quaternion();
  const localMatrix = new THREE.Matrix4();

  class Asteroid {
    constructor(app, mesh, localMatrix) {
      this.app = app;
      this.mesh = mesh.clone();
      this.mesh.applyMatrix4(localMatrix);
      this.app.add(this.mesh);
      this.mesh.updateMatrixWorld();
    }
  }

  class PhysicalAsteroid extends Asteroid {
    constructor(app, mesh, localMatrix, physics, physicsIds) {
      super(app, mesh, localMatrix);

      this.physicsId = physics.addGeometry(this.mesh);
      physicsIds.push(this.physicsId);
    }
  }

  class MovingAsteroid extends Asteroid {
    constructor(app, mesh, localMatrix, localEuler, movingAsteroids) {
      super(app, mesh, localMatrix);

      this.velocityX = Math.random() ** 2;
      localEuler.set(Math.random() / 100, Math.random() / 100, Math.random() / 100, 'XYZ');
      this.rotation = new THREE.Quaternion().setFromEuler(localEuler);
      movingAsteroids.push(this);
    }
    move() {
      if(this.mesh.position.x > 300) {
        this.mesh.position.setX(-300);
      }
      this.mesh.position.setX(this.mesh.position.x + this.velocityX);
      this.mesh.quaternion.premultiply(this.rotation);
    }
  }

  class MovingSoundAsteroid extends Asteroid {
    constructor(app, mesh, localMatrix, localEuler, movingAsteroids, soundBuffer) {
      super(app, mesh, localMatrix);

      this.sound = new THREE.PositionalAudio(audioListener);
      this.sound.setBuffer(soundBuffer);
      this.sound.setLoop(true);
      this.sound.setRefDistance( 5 );
      this.sound.setMaxDistance( 5 );
      this.sound.setDistanceModel('exponential');
      this.sound.play();
      this.mesh.children[0].children[0].children[0].add(this.sound);

      this.velocityX = Math.random() * 0.5 + 0.5;
      localEuler.set(Math.random() / 100, Math.random() / 100, Math.random() / 100, 'XYZ');
      this.rotation = new THREE.Quaternion().setFromEuler(localEuler);
      movingAsteroids.push(this);
    }
    move() {
      if(this.mesh.position.x > 300) {
        this.mesh.position.setX(-300);
      }
      this.mesh.position.setX(this.mesh.position.x + this.velocityX);
      this.mesh.quaternion.premultiply(this.rotation);
    }
  }

  const defaultSpawn = new THREE.Vector3(0, 5, 0);
  const movingAsteroids = [];

  let asteroids = [
    {
      position: new THREE.Vector3(0, 0, 0), 
      quat: new THREE.Quaternion(0, 0, 0, 1), 
      scale: new THREE.Vector3(0.04, 0.04, 0.04)
    },
    {
      position: new THREE.Vector3(8, 0, 0), 
      quat: new THREE.Quaternion(0, 0.7071067811865475, 0, 0.7071067811865476), 
      scale: new THREE.Vector3(0.03, 0.03, 0.03)
    },
    {
      position: new THREE.Vector3(16, 0, 0), 
      quat: new THREE.Quaternion(0, 0, 0, 1), 
      scale: new THREE.Vector3(0.02, 0.02, 0.02)
    },
    {
      position: new THREE.Vector3(27, -10, 5), 
      quat: new THREE.Quaternion(0, 1, 0, 0), 
      scale: new THREE.Vector3(0.05, 0.03, 0.05)
    },
    {
      position: new THREE.Vector3(38, -30, 0), 
      quat: new THREE.Quaternion(0, 0, 0, 1), 
      scale: new THREE.Vector3(0.04, 0.04, 0.04)
    },
    {
      position: new THREE.Vector3(48, -40, -10), 
      quat: new THREE.Quaternion(0, 0, 0, 1), 
      scale: new THREE.Vector3(0.04, 0.04, 0.04)
    },
    {
      position: new THREE.Vector3(58, -50, -15), 
      quat: new THREE.Quaternion(0, 0, 0, 1), 
      scale: new THREE.Vector3(0.06, 0.02, 0.06)
    }
  ];

  const audioListener = new THREE.AudioListener();
  localPlayer.add(audioListener);

  (async () => {
    let gltf = await new Promise((accept, reject) => {
        const {gltfLoader} = useLoaders();
        const url = 'https://patriboz.github.io/asteroids/assets/rock/scene.gltf';
        gltfLoader.load(url, accept, function onprogress() {}, reject);
    });

    let mesh = gltf.scene;

    let soundBuffer = await new Promise((accept, reject) => {
      const audioLoader = new THREE.AudioLoader();
      const url = 'https://patriboz.github.io/asteroids/assets/audio/white-noise.mp3';
      audioLoader.load(url, accept, function onprogress() {}, reject);
    });

    for(const asteroid of asteroids) {
      localMatrix.compose(asteroid.position, asteroid.quat, asteroid.scale);
      new PhysicalAsteroid(app, mesh, localMatrix, physics, physicsIds);
    }

    createAsteroidField(mesh, soundBuffer);
    app.updateMatrixWorld();
  })();


  useCleanup(() => {
    for (const physicsId of physicsIds) {
      physics.removeGeometry(physicsId);
    }
    for (const movingSoundAsteroid of movingSoundAsteroids) {
      movingSoundAsteroid.sound.stop();
    }
  });  

  
  let lastFoundObj;
  useFrame(({ timeDiff, timestamp }) => {

    if(localPlayer.avatar) {
      moveAsteroids();

      // https://github.com/webaverse/bridge-section/blob/main/index.js
      const downQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI*0.5);
        const resultDown = physics.raycast(localPlayer.position, downQuat);
        if(resultDown && localPlayer.characterPhysics.lastGroundedTime === timestamp) {
          let foundObj = metaversefile.getPhysicsObjectByPhysicsId(resultDown.objectId);
          if(foundObj && !(lastFoundObj === foundObj)) {
            lastFoundObj = foundObj;
          }
        }

      // Resets character position to spawn position
      if(localPlayer.position.y < -70) {
        physics.setCharacterControllerPosition(localPlayer.characterController, defaultSpawn);
      }
    }
    app.updateMatrixWorld();
  });

  const moveAsteroids = () => {
    for (const asteroid of movingAsteroids) {
      asteroid.move();
    }
  };

  const createAsteroidField = (mesh, soundBuffer) => {
    for(let i = 0; i < 100; i++) {
      localMatrix.compose(
        localVector.randomDirection().multiplyScalar(100).addScalar(30),
        localQuaternion.random(),
        localVector2.random().divideScalar(10)
      );
      new Asteroid(app, mesh, localMatrix);
    }

    for(let i = 0; i < 80; i++) {
      localMatrix.compose(
        localVector.randomDirection().multiplyScalar(100).addScalar(30),
        localQuaternion.random(),
        localVector2.random().divideScalar(10)
      );
      new MovingAsteroid(app, mesh, localMatrix, localEuler, movingAsteroids);
    }

    for(let i = 0; i < 10; i++) {
      localMatrix.compose(
        localVector.randomDirection().multiplyScalar(15).addScalar(10),
        localQuaternion.random(),
        localVector2.random().divideScalar(12)
      );
      let movingSoundAsteroid = new MovingSoundAsteroid(app, mesh, localMatrix, localEuler, movingAsteroids, soundBuffer);
      movingSoundAsteroids.push(movingSoundAsteroid);
    }
  };

  return app;
};