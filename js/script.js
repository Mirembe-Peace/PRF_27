import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MapControls } from 'three/addons/controls/MapControls.js';

//setting up the scene
const scene = new THREE.Scene();

//setting up the camera
const aspectRatio = window.innerWidth/window.innerHeight;
const camera = new THREE.PerspectiveCamera(90, aspectRatio, 0.1, 1000);
camera.position.set(84, 45, 288);

//setting upvthe canvas
const canvas = document.querySelector('.canvas');

//setting up the renderer
const renderer = new THREE.WebGLRenderer({canvas: canvas});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

//lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(-165.01445413093128, 539.25437520156, -216.11550290035518);
ambientLight.position.set(86.73729926481377, 140.41787049838712, 17.54735020570745);
scene.add(ambientLight);
scene.add(directionalLight);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

//device identification
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

//loader
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

//loading the model and texture
function loadMuseum(){
    const gltfLoader = new GLTFLoader(loadingManager);

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
        function ( xhr ) {
            console.log( (xhr.loaded / xhr.total * 100 ) + '% loaded');
        },
        function (error) {
            console.log('an error occured while loading museum model');
        }
    );
}

if(isMobile) {
    loadMuseum();
}
else{
    new RGBELoader()
    .setPath('https://storage.googleapis.com/pearl-artifacts-cdn/')
    .load('environment.hdr', function (texture){
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;

        loadMuseum();
    });
}

//operation functions

let exhibitHotspots = [];
let isAnimating = false;
let currentExhibit = null;
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
const raycaster = new THREE.Raycaster( new THREE.Vector3());

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

function createPictureHotspots() {
    pictureHotspotData.forEach((data) => {
        const geometry = new THREE.SphereGeometry(13, 24, 24);
        const material = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            transparent: true,
            opacity: 0.3 // change back after adjusting
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
    // Clear existing exhibit hotspots
    exhibitHotspots.forEach(hotspot => {
        scene.remove(hotspot.mesh);
    });
    exhibitHotspots = [];
    
    // Create 16 invisible hotspots
    hotspotData.forEach((data, index) => {
        const geometry = new THREE.SphereGeometry(13, 24, 24);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.3 // Completely invisible
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

    // Populate UI first
    exhibitTitle.textContent = data.title;
    exhibitDescription.textContent = data.description;
    exhibitUI.style.display = 'block';
            
            // // Load and play sound
            // audioLoader.load(data.soundPath, (buffer) => {
            //     sound.setBuffer(buffer);
            //     sound.setLoop(false);
            //     sound.setVolume(0.5);
            //     sound.play();
            //     currentExhibit.sound = sound;
                
            // // });
}

function closeExhibit(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
        
        // Stop sound
       if (currentExhibit && currentExhibit.sound) {
        currentExhibit.sound.stop();
        currentExhibit.sound.disconnect();
    }
        
        currentExhibit = null;
    // Hide UI
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
        }
        else {
            console.warn("Clicked on an exhibit hotspot but no data found.");
        }
    }

    //for the videos 
    // Check for picture hotspots
    const pictureIntersects = raycaster.intersectObjects(scene.children.filter(obj => obj.userData.isPicture));
    if (pictureIntersects.length > 0) {
        const clickedPicture = pictureIntersects[0].object;
        showYouTubeVideo(clickedPicture.userData.videoId, clickedPicture.userData.title, clickedPicture.userData.description);

        if( clickedPicture) {
            console.log("Clicked on a picture hotspot:", clickedPicture.userData.title);
        }

        else {
            console.warn("Clicked on a picture hotspot but no data found.");
    }
    
    }
}

canvas.addEventListener('pointerdown', onMouseClick, false);

window.addEventListener('click', onMouseClick, false);

window.addEventListener('resize', () => {
    camera.aspect = aspectRatio;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function showYouTubeVideo(videoId, title, description) {
    // Create or show video container
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
        
        // Close button
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
        });
        videoContainer.appendChild(closeButton);
        
        // Video info
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
        
        // YouTube iframe
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
    
    // Set the video source
    const iframe = document.getElementById('youtube-iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    
    // Update title and description
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



//instruction panel
const instructionButton = document.getElementById("instructionButton");
    instructionButton.addEventListener('click', () => {
        if (instructionContent.style.display === 'none') {
            
            instructionContent.style.display = 'block';
            }
    });

        // Close instructions when button is clicked
const instructionContent = document.getElementById('instruction-content');
        instructionContent?.addEventListener('click', (e) => {
        if (e.target.id === 'close-instructions') {
             e.stopPropagation();
            instructionContent.style.display = 'none';
        }
        
    });

//hotspot data
const hotspotData = [
        {
            position: new THREE.Vector3(-40, 18, -165),
            soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_8.mp3',
            title: "Ankle Rattles",
            description: "These are ankle rattles for wearing on the unkles to enhance the sound of music at celebrations like marriages and royal fuctions."
        },
        {
            position: new THREE.Vector3(-100, -4, -500),
            soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_4.mp3',
            title: "Axe",
            description: "This is a male traditional hoe called Eligo. It is held by the chief to show leadersip and was used as awar tool."
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
            description: "The is also called Eligo it is the female one held by the chiefs wife as a symbol of leadership also used in war.."
        },
        {
            position: new THREE.Vector3(-40, 18, -118),
            soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_6.mp3',
            title: "Goat sack",
            description: "This is a goat's hide, during the Kebu medieval times it was used as a carrying suck. When an elder went to visit and there was leftover food, it would be parked in this suck for him to take back with him."
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
            description: "Is an instrument that the Batwa used to play after a succfesful hunt. it is made of a flattended wooden slade with nylon or animal skin cut into stings and tied from end to end horizontally to produce different pitches when played. "
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
            description: "This is a shaker made out of calabash. It is used to evoc spirits of the ancestors. But now its used as a music instrument."
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
            description: "This is a wooden box instrument found in the Batwa community like in most Ugandan cultures, it has a box wooden body and metal pokes tied to its neck in diferent pitches. Its played using both thumb fingers to create sound."
        },
        {
            position: new THREE.Vector3(-52, 12, -336),
            soundPath: 'https://storage.googleapis.com/pearl-artifacts-cdn/museum_model/audio_2.mp3',
            title: "Thumb Piano",
            description: "The Lukembe is one of the musical instrumenets of the Ukebhu, it is made of a sqaure wooden box and metallic pokes tided to its neck with different pitches. Lekembe is played using two finger thumbs by strumming the pokes rythmically to create sound."
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
            description: "This is an istrument found among the Batwa, it is used for playing music while telling stories at the fire place. It is made of out of  Macademia nut tree branches and a gourd at the bottom to creat low end sound."
        }
]

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

let controls;

init();

//controls
function init() {
    controls = new MapControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 100;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;

}


function animate(){
    if (controls) {controls.update(); }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();



