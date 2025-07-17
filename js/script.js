import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Setting up the scene
const scene = new THREE.Scene();

// Setting up the camera
const aspectRatio = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(90, aspectRatio, 0.1, 1000);
camera.position.set(84, 45, 288);

// Setting up the canvas
const canvas = document.querySelector('.canvas');

// Setting up renderer
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
});

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(-165.01445413093128, 539.25437520156, -216.11550290035518);
ambientLight.position.set(86.73729926481377, 140.41787049838712, 17.54735020570745);
scene.add(ambientLight);
scene.add(directionalLight);

// Device identification
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Loader
const loadingManager = new THREE.LoadingManager(
    () => {
        // When all assets are loaded
        updateLoadingProgress(1);
    },
    (item, loaded, total) => {
        // Progress update
        updateLoadingProgress(loaded / total);
    }
);

// Controls
let controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let canJump = false;
const objects = []; 

// First-person controls variables
const moveSpeed = 30;
const lookSpeed = 0.002;
const verticalLookLimit = Math.PI / 3; // Limit vertical look angle

// Mouse movement variables
let isMouseLocked = false;
let previousMouseX = 0;
let previousMouseY = 0;

// Operation functions
let exhibitHotspots = [];
let isAnimating = false;
let currentExhibit = null;
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
const raycaster = new THREE.Raycaster(new THREE.Vector3());

// Create exhibit UI
const exhibitUI = document.createElement('div');
exhibitUI.id = 'exhibit-ui';
exhibitUI.style.display = 'none';
document.body.appendChild(exhibitUI);

const exhibitTitle = document.createElement('h2');
exhibitTitle.id = 'exhibit-title';
exhibitUI.appendChild(exhibitTitle);

const exhibitDescription = document.createElement('p');
exhibitDescription.id = 'exhibit-description';
exhibitUI.appendChild(exhibitDescription);

const closeButton = document.createElement('button');
closeButton.id = 'close-exhibit';
closeButton.textContent = 'Close';
closeButton.addEventListener('click', (event) => closeExhibit(event));
exhibitUI.appendChild(closeButton);

// Initialize the application
function init() {
    if (!isMobile) {
        setupMouseLock();
        setupKeyboardControls();
    }
    loadMuseum();
}

// Loading the model and texture
function loadMuseum() {
    const gltfLoader = new GLTFLoader(loadingManager);

    if (isMobile) {
        loadGLTF();
    } else {
        new RGBELoader()
            .setPath('https://storage.googleapis.com/pearl-artifacts-cdn/')
            .load('environment.hdr', function (texture) {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.background = texture;
                scene.environment = texture;
                loadGLTF();
            });
    }

    function loadGLTF() {
        gltfLoader.load(
            'https://storage.googleapis.com/pearl-artifacts-cdn/museum_test_1blend.gltf',
            function (gltf) {
                const museum = gltf.scene;
                museum.position.set(0, 0, 0);
                museum.scale.set(2, 2, 2);
                scene.add(museum);

                createExhibitHotspots();
                createPictureHotspots();
            },
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            function (error) {
                console.log('An error occurred while loading museum model', error);
            }
        );
    }
}

function createPictureHotspots() {
    pictureHotspotData.forEach((data) => {
        const geometry = new THREE.SphereGeometry(13, 24, 24);
        const material = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            transparent: true,
            opacity: 0
        });
        const pictureFrame = new THREE.Mesh(geometry, material);
        pictureFrame.position.copy(data.position);
        pictureFrame.userData = { 
            isPicture: true,
            videoId: data.videoId,
            title: data.title,
            description: data.description
        };
        scene.add(pictureFrame);
    });
}

function createExhibitHotspots() {
    exhibitHotspots.forEach(hotspot => {
        scene.remove(hotspot.mesh);
    });
    exhibitHotspots = [];
    
    hotspotData.forEach((data, index) => {
        const geometry = new THREE.SphereGeometry(13, 24, 24);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(data.position);
        sphere.userData = { exhibitData: data };
        scene.add(sphere);
        
        exhibitHotspots.push({
            mesh: sphere,
            exhibitData: data
        });
    });
}

function showExhibit(data) {
    closeExhibit();

    exhibitTitle.textContent = data.title;
    exhibitDescription.textContent = data.description;
    exhibitUI.style.display = 'block';
    currentExhibit = data;
    
    if (data.soundPath) {
        audioLoader.load(data.soundPath, (buffer) => {
            sound.setBuffer(buffer);
            sound.setLoop(false);
            sound.setVolume(0.5);
            sound.play();
            currentExhibit.sound = sound;
        });
    }
}

function closeExhibit(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    if (currentExhibit && currentExhibit.sound) {
        currentExhibit.sound.stop();
        currentExhibit.sound.disconnect();
    }
    
    currentExhibit = null;
    exhibitUI.style.display = 'none';
}

const mouse = new THREE.Vector2();

function onMouseClick(event) {
    if (isAnimating || exhibitUI.style.display === 'block' || document.getElementById('video-container')) return;
    
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check for exhibit hotspots
    const allExhibitObjects = exhibitHotspots.map(h => h.mesh);
    const exhibitIntersects = raycaster.intersectObjects(allExhibitObjects);
    
    if (exhibitIntersects.length > 0) {
        const clickedHotspot = exhibitHotspots.find(h => h.mesh === exhibitIntersects[0].object);
        if (clickedHotspot) {
            showExhibit(clickedHotspot.exhibitData);
        } else {
            console.warn("Clicked on an exhibit hotspot but no data found.");
        }
    }

    // Check for picture hotspots
    const pictureIntersects = raycaster.intersectObjects(scene.children.filter(obj => obj.userData.isPicture));
    if (pictureIntersects.length > 0) {
        const clickedPicture = pictureIntersects[0].object;
        showYouTubeVideo(clickedPicture.userData.videoId, clickedPicture.userData.title, clickedPicture.userData.description);
    }
}

// Setup mouse lock
function setupMouseLock() {
    canvas.addEventListener('click', (e) => {
        if (!isMouseLocked && 
            !e.target.closest('#instruction-content') && 
            !e.target.closest('#close-instructions') &&
            !e.target.closest('#exhibit-ui') &&
            !e.target.closest('#video-container')) {
            canvas.requestPointerLock = canvas.requestPointerLock || 
                                     canvas.mozRequestPointerLock || 
                                     canvas.webkitRequestPointerLock;
            canvas.requestPointerLock();
        }
    });
    
    document.addEventListener('pointerlockchange', lockChangeAlert, false);
    document.addEventListener('mozpointerlockchange', lockChangeAlert, false);
    document.addEventListener('webkitpointerlockchange', lockChangeAlert, false);

    function lockChangeAlert() {
        if (document.pointerLockElement === canvas || 
            document.mozPointerLockElement === canvas || 
            document.webkitPointerLockElement === canvas) {
            if (exhibitUI.style.display === 'block' || document.getElementById('video-container')) {
                document.exitPointerLock();
                return;
            }
            isMouseLocked = true;
            document.addEventListener('mousemove', onMouseMove, false);
        } else {
            isMouseLocked = false;
            document.removeEventListener('mousemove', onMouseMove, false);
        }
    }
}

// Mouse movement handler
function onMouseMove(e) {
    if (!isMouseLocked) return;

    const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
    const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

    // Horizontal rotation (left/right)
    camera.rotation.y -= movementX * lookSpeed;

    // Vertical rotation (up/down) with limits
    camera.rotation.x -= movementY * lookSpeed;
    camera.rotation.x = Math.max(-verticalLookLimit, Math.min(verticalLookLimit, camera.rotation.x));
}

function setupKeyboardControls() {
    controls = new PointerLockControls(camera, renderer.domElement);

    const onKeyDown = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump === true) velocity.y += 350;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

// Setting up the renderer
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function showYouTubeVideo(videoId, title, description) {
    let videoContainer = document.getElementById('video-container');
    
    if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = 'video-container';
        videoContainer.style.position = 'fixed';
        videoContainer.style.top = '0';
        videoContainer.style.left = '0';
        videoContainer.style.width = '100%';
        videoContainer.style.height = '100%';
        videoContainer.style.backgroundColor = 'rgba(0,0,0,0.9)';
        videoContainer.style.zIndex = '1000';
        videoContainer.style.display = 'flex';
        videoContainer.style.flexDirection = 'column';
        videoContainer.style.justifyContent = 'center';
        videoContainer.style.alignItems = 'center';
        
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '20px';
        closeButton.style.right = '20px';
        closeButton.style.padding = '10px 20px';
        closeButton.style.backgroundColor = '#333';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.zIndex = '1001';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(videoContainer);
            if (isMouseLocked) {
                canvas.requestPointerLock();
            }
        });
        videoContainer.appendChild(closeButton);
        
        const infoDiv = document.createElement('div');
        infoDiv.style.color = 'white';
        infoDiv.style.textAlign = 'center';
        infoDiv.style.marginBottom = '20px';
        infoDiv.style.maxWidth = '800px';
        
        const titleElement = document.createElement('h2');
        titleElement.textContent = title;
        infoDiv.appendChild(titleElement);
        
        const descElement = document.createElement('p');
        descElement.textContent = description;
        infoDiv.appendChild(descElement);
        
        videoContainer.appendChild(infoDiv);
        
        const iframe = document.createElement('iframe');
        iframe.id = 'youtube-iframe';
        iframe.style.border = 'none';
        iframe.style.width = '80%';
        iframe.style.height = '60%';
        iframe.style.maxWidth = '1200px';
        iframe.allowFullscreen = true;
        videoContainer.appendChild(iframe);
        
        document.body.appendChild(videoContainer);
    } else {
        videoContainer.style.display = 'flex';
    }
    
    const iframe = document.getElementById('youtube-iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    
    const titleElement = videoContainer.querySelector('h2');
    const descElement = videoContainer.querySelector('p');
    titleElement.textContent = title;
    descElement.textContent = description;
}

function updateLoadingProgress(progress) {
    const percentage = Math.round(progress * 100);
    document.getElementById('loading-percentage').textContent = percentage;
    document.getElementById('progress-bar-fill').style.width = `${percentage}%`;

    if (percentage >= 100) {
        setTimeout(() => {
            document.querySelector('.loading-screen').classList.add('fade-out');
        }, 500);
    }
}

// Instruction panel
const instructionButton = document.getElementById("instructionButton");
const instructionContent = document.getElementById('instruction-content');

instructionContent.style.display = 'none';

instructionButton.addEventListener('click', (e) => {
    e.stopPropagation();
    instructionContent.style.display = instructionContent.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('close-instructions')?.addEventListener('click', (e) => {
    e.stopPropagation();
    instructionContent.style.display = 'none';
});

document.addEventListener('click', (e) => {
    if (!instructionContent.contains(e.target)) {
        instructionContent.style.display = 'none';
    }
});

// Home button
document.getElementById('homeButton').addEventListener('click', () => {
    window.location.href = "https://pearlrhythmfoundation.org/category/art-archive/";
});

// Hotspot data
const hotspotData = [
    {
        position: new THREE.Vector3(-40, 18, -165),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_8.mp3',
        title: "Ankle Rattles",
        description: "These are ankle rattles for wearing on the ankles to enhance the sound of music at celebrations like marriages and royal functions."
    },
    {
        position: new THREE.Vector3(-100, -4, -500),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_4.mp3',
        title: "Axe",
        description: "This is a male traditional hoe called Eligo. It is held by the chief to show leadership and was used as a war tool."
    },
    {
        position: new THREE.Vector3(-100, 40, -510),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_3.mp3',
        title: "Bow",
        description: "Bow model."
    },
    {
        position: new THREE.Vector3(-100, 90, -515),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_3.mp3',
        title: "Elegu",
        description: "This is also called Eligo it is the female one held by the chief's wife as a symbol of leadership also used in war."
    },
    {
        position: new THREE.Vector3(-40, 18, -118),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_6.mp3',
        title: "Goat sack",
        description: "This is a goat's hide, during the Kebu medieval times it was used as a carrying sack. When an elder went to visit and there was leftover food, it would be packed in this sack for him to take back with him."
    },
    {
        position: new THREE.Vector3(-40, 20, -207),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_6.mp3',
        title: "Kebu Horn",
        description: "These horns are found in the neck of every Kebu man. They are for signaling danger or general mobilization depending on the pattern of how they are being blown."
    },
    {
        position: new THREE.Vector3(-250, 22, -151),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_6.mp3',
        title: "Kebu Pot",
        description: "The pot is a very important commodity to the Kebu society and home. The Kebu people never used iron to cook. Clay pots were used for cooking, collecting water and preserving food itself."
    },
    {
        position: new THREE.Vector3(-40, 18, -30),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_6.mp3',
        title: "Miya Skin",
        description: "This is a Miya cat skin, it is one of the Kebu people's artifacts. It used to be used to ward away epidemics that broke out during medieval times. It used to be waved by the chief as he cast out sickness from his land."
    },
    {
        position: new THREE.Vector3(202, 17, -194),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_8.mp3',
        title: "Enanga",
        description: "Is an instrument that the Batwa used to play after a successful hunt. It is made of a flattened wooden slade with nylon or animal skin cut into strings and tied from end to end horizontally to produce different pitches when played."
    },
    {
        position: new THREE.Vector3(-40, 20, -65),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_8.mp3',
        title: "Ogorogogo",
        description: "This is a farming tool used by the Ukebhu for harrowing, it is called Agorogoro. It normally has got an iron fixed on its sharp end."
    },
    {
        position: new THREE.Vector3(-255, 25, -367),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_2.mp3',
        title: "Shaker",
        description: "This is a shaker made out of calabash. It is used to evoke spirits of the ancestors. But now it's used as a music instrument."
    },
    {
        position: new THREE.Vector3(211, 17, -60),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_2.mp3',
        title: "Sticks",
        description: "These are sticks called Imirosho used by the Batwa in cultural dances and performances. They are used for drumming or as dance props."
    },
    {
        position: new THREE.Vector3(206, 20, -444),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_2.mp3',
        title: "Ikumbi (Thumb Piano)",
        description: "This is a wooden box instrument found in the Batwa community like in most Ugandan cultures, it has a box wooden body and metal pokes tied to its neck in different pitches. It's played using both thumb fingers to create sound."
    },
    {
        position: new THREE.Vector3(-52, 12, -336),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_2.mp3',
        title: "Thumb Piano",
        description: "The Lukembe is one of the musical instruments of the Ukebhu, it is made of a square wooden box and metallic pokes tied to its neck with different pitches. Lekembe is played using two finger thumbs by strumming the pokes rhythmically to create sound."
    },
    {
        position: new THREE.Vector3(-52, 12, 107),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_6.mp3',
        title: "Vaccum",
        description: "This is a food warmer called Abhoro. It is used to keep food fresh and warm."
    },
    {
        position: new THREE.Vector3(10, -5, -115),
        soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_2.mp3',
        title: "Umunahi",
        description: "This is an instrument found among the Batwa, it is used for playing music while telling stories at the fire place. It is made of out of Macademia nut tree branches and a gourd at the bottom to create low end sound."
    }
];

const pictureHotspotData = [
    {
        position: new THREE.Vector3(-255, 45, -40), 
        videoId: "A9P7MDe9xfQ", 
        title: "Sembagare",
        description: "Sembagare"
    },
    {
        position: new THREE.Vector3(-255, 45, -250), 
        videoId: "2YNjtXqCO_Q",
        title: "Paskazia Nyiragaromba",
        description: "Paskazia Nyiragaromba"
    },
    {
        position: new THREE.Vector3(-255, 45, -470), 
        videoId: "VXkjMivVNc8", 
        title: "Birara Dance",
        description: "Birara Dance"
    },
    {
        position: new THREE.Vector3(170, 0, -106), 
        videoId: "SV6mbdtQ_qw", 
        title: "The fire making stick",
        description: "The fire making stick"
    },
    {
        position: new THREE.Vector3(10, 50, -115), 
        videoId: "5ps75Q-4Zi4", 
        title: "Batwa Dance",
        description: "Batwa Dance"
    },
    {
        position: new THREE.Vector3(170, 0, -125), 
        videoId: "z6iG4wFgZfc", 
        title: "Enanga",
        description: "Enanga"
    },
    {
        position: new THREE.Vector3(206, 40, -330), 
        videoId: "llJWRdh4zIc", 
        title: "Thumb Piano",
        description: "Thumb Piano"
    },
    {
        position: new THREE.Vector3(90, 20, -520),
        videoId: "i78wqPZQfb0", 
        title: "Seeke",
        description: "Seeke"
    }
];

function animate() {
    const time = performance.now();

    if (controls && controls.isLocked === true) {
        raycaster.ray.origin.copy(controls.object.position);
        raycaster.ray.origin.y -= 10;

        const intersections = raycaster.intersectObjects(objects, false);
        const onObject = intersections.length > 0;

        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        if (onObject === true) {
            velocity.y = Math.max(0, velocity.y);
            canJump = true;
        }

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.object.position.y += (velocity.y * delta);

        if (controls.object.position.y < 10) {
            velocity.y = 0;
            controls.object.position.y = 10;
            canJump = true;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Event listeners
canvas.addEventListener('pointerdown', onMouseClick, false);
window.addEventListener('click', onMouseClick, false);

// Start the application
init();
animate();