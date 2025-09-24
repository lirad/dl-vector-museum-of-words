import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PCA } from "ml-pca";

interface Visualization3DProps {
  words: string[];
  vectors: Float32Array[];
  selected: number | null;
  onSelect: (index: number) => void;
  dark: boolean;
  neighbors: number;
  selectedNeighbors: { index: number; sim: number }[] | null;
}

export function Visualization3D({ 
  words, 
  vectors, 
  selected, 
  onSelect, 
  dark, 
  // neighbors,
  selectedNeighbors
}: Visualization3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameIdRef = useRef<number>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Points and labels for interaction
  const pointsRef = useRef<THREE.Points>();
  const labelsRef = useRef<THREE.Group>();
  const connectionsRef = useRef<THREE.Group>();
  const arrowsRef = useRef<THREE.Group>();
  const raycaster = useRef<THREE.Raycaster>();
  const mouse = useRef<THREE.Vector2>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // State for PCA analysis
  const [pcaAnalysis, setPcaAnalysis] = useState<{
    coords: number[][];
    varianceExplained: number[];
    totalVariance: number;
  } | null>(null);

  // Reduce vectors to 3D using proper PCA
  const reduceTo3D = (vecs: Float32Array[]): { coords: number[][], varianceExplained: number[], totalVariance: number } => {
    if (vecs.length === 0) return { coords: [], varianceExplained: [0, 0, 0], totalVariance: 0 };
    
    console.log('Running PCA on', vecs.length, 'vectors with', vecs[0].length, 'dimensions');
    
    // Convert to regular arrays for PCA
    const data = vecs.map(v => Array.from(v));
    
    // Perform PCA
    const pca = new PCA(data);
    
    // Get 3D projection
    const projected = pca.predict(data, { nComponents: 3 });
    
    // Scale the coordinates for better visualization
    const coords = projected.to2DArray().map(row => [
      row[0] * 15, // Scale factor for better visibility
      row[1] * 15,
      row[2] * 15
    ]);
    
    // Get variance explained
    const varianceExplained = pca.getExplainedVariance();
    const totalVariance = varianceExplained.slice(0, 3).reduce((sum, val) => sum + val, 0);
    
    console.log('PCA complete. Variance explained:', varianceExplained.slice(0, 3).map(v => `${(v*100).toFixed(1)}%`));
    console.log('Total variance captured in 3D:', `${(totalVariance*100).toFixed(1)}%`);
    
    return {
      coords,
      varianceExplained: varianceExplained.slice(0, 3),
      totalVariance
    };
  };

  const addCoordinateAxes = (scene: THREE.Scene, isDark: boolean) => {
    const axisLength = 25;
    const axisColor = isDark ? 0x666666 : 0x999999;
    
    // X axis (red)
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisLength, 0, 0),
      new THREE.Vector3(axisLength, 0, 0)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, opacity: 0.7, transparent: true });
    const xAxis = new THREE.Line(xGeometry, xMaterial);
    scene.add(xAxis);
    
    // Y axis (green)
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({ color: 0x44ff44, opacity: 0.7, transparent: true });
    const yAxis = new THREE.Line(yGeometry, yMaterial);
    scene.add(yAxis);
    
    // Z axis (blue)
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -axisLength),
      new THREE.Vector3(0, 0, axisLength)
    ]);
    const zMaterial = new THREE.LineBasicMaterial({ color: 0x4444ff, opacity: 0.7, transparent: true });
    const zAxis = new THREE.Line(zGeometry, zMaterial);
    scene.add(zAxis);
    
    // Add axis labels
    const createAxisLabel = (text: string, position: THREE.Vector3, color: number) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 64;
      canvas.height = 32;
      
      context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      context.font = 'bold 24px Arial';
      context.textAlign = 'center';
      context.fillText(text, 32, 22);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position);
      sprite.scale.set(3, 1.5, 1);
      scene.add(sprite);
    };
    
    createAxisLabel('PC1', new THREE.Vector3(axisLength + 3, 0, 0), 0xff4444);
    createAxisLabel('PC2', new THREE.Vector3(0, axisLength + 3, 0), 0x44ff44);
    createAxisLabel('PC3', new THREE.Vector3(0, 0, axisLength + 3), 0x4444ff);
  };
  
  const addGrid = (scene: THREE.Scene, isDark: boolean) => {
    const size = 50;
    const divisions = 10;
    const colorGrid = isDark ? 0x222222 : 0xcccccc;
    
    // XY plane grid
    const gridXY = new THREE.GridHelper(size, divisions, colorGrid, colorGrid);
    gridXY.rotateX(Math.PI / 2);
    gridXY.material.opacity = 0.2;
    gridXY.material.transparent = true;
    scene.add(gridXY);
    
    // XZ plane grid (at origin)
    const gridXZ = new THREE.GridHelper(size, divisions, colorGrid, colorGrid);
    gridXZ.material.opacity = 0.1;
    gridXZ.material.transparent = true;
    scene.add(gridXZ);
  };

  const addMouseInteraction = (domElement: HTMLElement, camera: THREE.PerspectiveCamera, scene: THREE.Scene) => {
    const onMouseMove = (event: MouseEvent) => {
      const rect = domElement.getBoundingClientRect();
      mouse.current!.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current!.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Update raycaster
      raycaster.current!.setFromCamera(mouse.current!, camera);
      
      // Check for intersections with points
      const pointsGroup = pointsRef.current;
      if (pointsGroup) {
        const intersects = raycaster.current!.intersectObjects(pointsGroup.children);
        
        if (intersects.length > 0) {
          const newHoveredIndex = intersects[0].object.userData.index;
          setHoveredIndex(newHoveredIndex);
          domElement.style.cursor = 'pointer';
        } else {
          setHoveredIndex(null);
          domElement.style.cursor = 'default';
        }
      }
    };
    
    const onClick = (event: MouseEvent) => {
      const rect = domElement.getBoundingClientRect();
      mouse.current!.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current!.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.current!.setFromCamera(mouse.current!, camera);
      
      const pointsGroup = pointsRef.current;
      if (pointsGroup) {
        const intersects = raycaster.current!.intersectObjects(pointsGroup.children);
        
        if (intersects.length > 0) {
          const clickedIndex = intersects[0].object.userData.index;
          onSelect(clickedIndex);
        }
      }
    };
    
    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('click', onClick);
    
    return () => {
      domElement.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('click', onClick);
    };
  };

  // Touch interaction for mobile devices
  const addTouchInteraction = (domElement: HTMLElement, camera: THREE.PerspectiveCamera, scene: THREE.Scene) => {
    let lastTouchTime = 0;
    
    const onTouchStart = (event: TouchEvent) => {
      // Prevent default to avoid scrolling
      if (event.touches.length === 1) {
        event.preventDefault();
      }
    };
    
    const onTouchEnd = (event: TouchEvent) => {
      const now = Date.now();
      const timeDiff = now - lastTouchTime;
      
      // Detect tap (not swipe)
      if (timeDiff < 300 && event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        const rect = domElement.getBoundingClientRect();
        
        mouse.current!.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.current!.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.current!.setFromCamera(mouse.current!, camera);
        
        const pointsGroup = pointsRef.current;
        if (pointsGroup) {
          const intersects = raycaster.current!.intersectObjects(pointsGroup.children);
          
          if (intersects.length > 0) {
            const touchedIndex = intersects[0].object.userData.index;
            onSelect(touchedIndex);
          }
        }
      }
      
      lastTouchTime = now;
    };
    
    domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    domElement.addEventListener('touchend', onTouchEnd);
    
    return () => {
      domElement.removeEventListener('touchstart', onTouchStart);
      domElement.removeEventListener('touchend', onTouchEnd);
    };
  };

  const addOrbitControls = (camera: THREE.PerspectiveCamera, domElement: HTMLElement) => {
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let radius = 15; // Start at distance 15

    const updateCameraPosition = () => {
      camera.position.x = Math.cos(targetX) * Math.cos(targetY) * radius;
      camera.position.y = Math.sin(targetY) * radius;
      camera.position.z = Math.sin(targetX) * Math.cos(targetY) * radius;
      camera.lookAt(0, 0, 0);
    };

    const onMouseDown = (event: MouseEvent) => {
      // Only start orbit if not clicking on a 3D object
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isMouseDown) return;
      
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      
      targetX += deltaX * 0.01;
      targetY += deltaY * 0.01;
      
      // Clamp vertical rotation
      targetY = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, targetY));
      
      updateCameraPosition();
      
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      
      const zoomSpeed = 0.1;
      const delta = event.deltaY > 0 ? 1 : -1;
      
      // Zoom in/out by changing radius
      radius += delta * zoomSpeed * radius;
      
      // Clamp zoom limits
      radius = Math.max(3, Math.min(50, radius));
      
      updateCameraPosition();
    };

    domElement.addEventListener('mousedown', onMouseDown);
    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('mouseleave', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    
    return () => {
      domElement.removeEventListener('mousedown', onMouseDown);
      domElement.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('mouseleave', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
    };
  };

  const createPoints = (scene: THREE.Scene, coords: number[][], labels: string[], selectedIndex: number | null, isDark: boolean) => {
    // Create individual spheres for better interaction
    const pointsGroup = new THREE.Group();
    
    coords.forEach((coord, i) => {
      // Create sphere geometry for each point
      const geometry = new THREE.SphereGeometry(0.8, 20, 20);
      
      // Color based on selection and hover
      const isSelected = selectedIndex === i;
      const isHovered = hoveredIndex === i;
      
      let color: THREE.Color;
      if (isSelected) {
        color = new THREE.Color(0xff4444); // Bright red for selected
      } else if (isHovered) {
        color = new THREE.Color(0xffdd00); // Bright yellow for hovered
      } else {
        color = new THREE.Color(0x4488ff); // Nice blue for normal
      }
      
      const material = new THREE.MeshPhongMaterial({ 
        color,
        transparent: true,
        opacity: isSelected ? 1.0 : 0.85,
        shininess: isSelected ? 100 : 30,
        emissive: isSelected ? new THREE.Color(0x220000) : new THREE.Color(0x000000)
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(coord[0], coord[1], coord[2]);
      sphere.userData = { index: i, word: labels[i] };
      
      // Add glow effect for selected items
      if (isSelected) {
        const glowGeometry = new THREE.SphereGeometry(1.2, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0xff4444,
          transparent: true,
          opacity: 0.2,
          side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(coord[0], coord[1], coord[2]);
        pointsGroup.add(glow);
      }
      
      pointsGroup.add(sphere);
    });
    
    pointsRef.current = pointsGroup as any;
    scene.add(pointsGroup);

    // Add text labels
    const labelsGroup = new THREE.Group();
    labelsRef.current = labelsGroup;
    
    coords.forEach((coord, i) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 256;
      canvas.height = 64;
      
      context.fillStyle = isDark ? '#ffffff' : '#000000';
      context.font = '20px Arial';
      context.textAlign = 'center';
      context.fillText(labels[i], 128, 35);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMaterial);
      
      sprite.position.set(coord[0], coord[1] + 1, coord[2]);
      sprite.scale.set(2, 0.5, 1);
      
      labelsGroup.add(sprite);
    });
    
    scene.add(labelsGroup);
  };

  const createVectorArrows = (scene: THREE.Scene, coords: number[][], vectors: Float32Array[], selectedIndex: number | null, isDark: boolean) => {
    const arrowsGroup = new THREE.Group();
    arrowsRef.current = arrowsGroup;
    
    coords.forEach((coord, i) => {
      const [x, y, z] = coord;
      
      // Show direction based on position relative to center (0,0,0)
      // This represents the semantic direction in the reduced 3D space
      const direction = new THREE.Vector3(x, y, z);
      const length = direction.length();
      
      if (length < 0.5) return; // Skip words too close to center
      
      // Normalize and create a small arrow pointing in the semantic direction
      direction.normalize();
      const lineLength = 1; // Made smaller
      
      // Start the line at the word position
      const wordPosition = new THREE.Vector3(x, y, z);
      const startPos = wordPosition.clone();
      const endPos = wordPosition.clone().add(direction.clone().multiplyScalar(lineLength));
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
      
      const isSelected = selectedIndex === i;
      const opacity = selectedIndex != null ? (isSelected ? 0.9 : 0.4) : 0.6;
      
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xfbbf24, // Yellow color
        transparent: true,
        opacity: opacity,
        linewidth: 2
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      arrowsGroup.add(line);
      
      // Add arrow tip (small cone)
      const tipRadius = 0.05;
      const tipHeight = 0.15;
      const coneGeometry = new THREE.ConeGeometry(tipRadius, tipHeight, 6);
      const coneMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xfbbf24,
        transparent: true,
        opacity: opacity
      });
      
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.position.copy(endPos);
      
      // Orient the cone to point in the direction of the arrow
      cone.lookAt(endPos.clone().add(direction));
      
      arrowsGroup.add(cone);
    });
    
    scene.add(arrowsGroup);
    return arrowsGroup;
  };

  const createConnections = (scene: THREE.Scene, coords: number[][], neighbors: { index: number; sim: number }[] | null, selectedIndex: number | null) => {
    const connectionsGroup = new THREE.Group();
    connectionsRef.current = connectionsGroup;
    
    if (selectedIndex !== null && neighbors && coords[selectedIndex]) {
      const selectedPos = coords[selectedIndex];
      
      neighbors.forEach(({ index, sim }) => {
        if (coords[index]) {
          const neighborPos = coords[index];
          
          const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(selectedPos[0], selectedPos[1], selectedPos[2]),
            new THREE.Vector3(neighborPos[0], neighborPos[1], neighborPos[2])
          ]);
          
          // Color based on similarity
          let color = 0xff0000; // Red for low similarity
          if (sim > 0.7) color = 0x00ff00; // Green for high similarity
          else if (sim > 0.4) color = 0xffff00; // Yellow for medium
          else if (sim > 0.1) color = 0xff8800; // Orange for low-medium
          
          const material = new THREE.LineBasicMaterial({ 
            color,
            transparent: true,
            opacity: 0.6
          });
          
          const line = new THREE.Line(geometry, material);
          connectionsGroup.add(line);
        }
      });
    }
    
    scene.add(connectionsGroup);
  };

  // Initialize Three.js scene
  useEffect(() => {
    console.log('🚀 3D useEffect triggered');
    console.log('📊 Container ref:', !!containerRef.current);
    console.log('📊 Vectors length:', vectors.length);
    console.log('📊 Words:', words);
    
    if (vectors.length === 0) {
      console.log('❌ No vectors available for 3D visualization yet');
      return;
    }

    // Wait for DOM to be ready
    const initializeScene = () => {
      console.log('🔍 Checking container availability...');
      if (!containerRef.current) {
        console.log('❌ Container ref still not available');
        return;
      }

      console.log('✅ Container ref available:', containerRef.current);
      console.log('✅ Container dimensions:', containerRef.current.clientWidth, 'x', containerRef.current.clientHeight);
      console.log('✅ Starting 3D scene initialization...');
      
      try {
      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      console.log('Initializing 3D scene with', vectors.length, 'vectors');
      console.log('Container dimensions:', width, 'x', height);

      // Check if container has valid dimensions
      if (width === 0 || height === 0) {
        console.log('Container has no dimensions, retrying in 100ms...');
        setTimeout(() => {
          if (containerRef.current) {
            setIsLoading(true); // Force re-render
          }
        }, 100);
        return;
      }

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(dark ? 0x0a0a0b : 0xffffff);
      sceneRef.current = scene;

      // Camera with mobile optimizations
      const isMobile = width < 768;
      const camera = new THREE.PerspectiveCamera(
        isMobile ? 85 : 75, // Wider FOV on mobile for better view
        width / height, 
        0.1, 
        1000
      );
      camera.position.set(
        isMobile ? 8 : 10, 
        isMobile ? 8 : 10, 
        isMobile ? 8 : 10
      );
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Renderer with mobile performance optimizations
      const renderer = new THREE.WebGLRenderer({ 
        antialias: !isMobile, // Disable antialiasing on mobile for better performance
        alpha: true,
        powerPreference: isMobile ? "default" : "high-performance"
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
      rendererRef.current = renderer;
      
      // Clear container and add renderer
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      console.log('🔄 Creating 3D coordinates...');
      // Create 3D points using PCA to reduce to 3D
      const analysis = reduceTo3D(vectors);
      console.log('✅ PCA analysis complete');
      setPcaAnalysis(analysis);
      console.log('✅ Created coordinates for', analysis.coords.length, 'points');
      
      console.log('Adding coordinate axes and grid...');
      addCoordinateAxes(scene, dark);
      addGrid(scene, dark);
      
      console.log('Creating points and labels...');
      createPoints(scene, analysis.coords, words, selected, dark);
      
      console.log('Creating vector arrows...');
      createVectorArrows(scene, analysis.coords, vectors, selected, dark);
      
      console.log('Creating connections...');
      createConnections(scene, analysis.coords, selectedNeighbors, selected);

      console.log('Setting up interaction...');
      // Initialize raycaster for point picking
      raycaster.current = new THREE.Raycaster();
      mouse.current = new THREE.Vector2();
      
      console.log('Adding orbit controls...');
      // Add orbit controls (basic mouse controls)
      const orbitCleanup = addOrbitControls(camera, renderer.domElement);
      
      // Add mouse interaction for point selection
      const interactionCleanup = addMouseInteraction(renderer.domElement, camera, scene);
      
      // Add touch interaction for mobile devices
      const touchCleanup = isMobile ? addTouchInteraction(renderer.domElement, camera, scene) : null;
      
      // Store cleanup functions
      cleanupFunctionsRef.current = [orbitCleanup, interactionCleanup, ...(touchCleanup ? [touchCleanup] : [])];

      console.log('Adding lighting...');
      // Enhanced lighting for better material appearance
      const ambientLight = new THREE.AmbientLight(dark ? 0x404040 : 0x606060, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(dark ? 0xffffff : 0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      directionalLight.castShadow = false; // Disable shadows for performance
      scene.add(directionalLight);
      
      // Add a second light for better illumination
      const fillLight = new THREE.DirectionalLight(dark ? 0x4444ff : 0x88aaff, 0.3);
      fillLight.position.set(-10, -10, -5);
      scene.add(fillLight);

      console.log('Starting animation loop...');
      // Animation loop
      const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      console.log('3D scene initialized successfully');
        setIsLoading(false);
        setError(null);
      } catch (err) {
        console.error('❌ 3D visualization error:', err);
        console.error('❌ Error details:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize 3D visualization');
        setIsLoading(false);
      }
    };

    // Try to initialize immediately
    if (containerRef.current) {
      initializeScene();
    } else {
      // Wait for next animation frame for DOM to be ready
      console.log('⏳ Waiting for DOM to be ready...');
      requestAnimationFrame(() => {
        if (containerRef.current) {
          initializeScene();
        } else {
          console.log('⏳ Still waiting, trying setTimeout...');
          setTimeout(initializeScene, 100);
        }
      });
    }

    // Cleanup
    return () => {
      console.log('Cleaning up 3D scene...');
      
      // Call all cleanup functions
      cleanupFunctionsRef.current.forEach(cleanup => cleanup && cleanup());
      cleanupFunctionsRef.current = [];
      
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      if (pointsRef.current) {
        // pointsRef.current is now a Group containing spheres
        (pointsRef.current as any).children.forEach((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      }
      if (labelsRef.current) {
        labelsRef.current.children.forEach(child => {
          if (child instanceof THREE.Sprite) {
            child.material.dispose();
            if (child.material.map) child.material.map.dispose();
          }
        });
      }
      if (connectionsRef.current) {
        connectionsRef.current.children.forEach(child => {
          if (child instanceof THREE.Line) {
            child.geometry.dispose();
            (child.material as THREE.LineBasicMaterial).dispose();
          }
        });
      }
      if (arrowsRef.current) {
        arrowsRef.current.children.forEach(child => {
          if (child instanceof THREE.Line) {
            child.geometry.dispose();
            (child.material as THREE.LineBasicMaterial).dispose();
          } else if (child instanceof THREE.Mesh) {
            // Dispose cone geometry and material
            child.geometry.dispose();
            (child.material as THREE.MeshBasicMaterial).dispose();
          }
        });
      }
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        const gl = rendererRef.current.getContext();
        if (gl && gl.getExtension('WEBGL_lose_context')) {
          gl.getExtension('WEBGL_lose_context')!.loseContext();
        }
      }
    };
  }, [vectors, words, dark]);

  // Update point colors when selection or hover changes
  useEffect(() => {
    if (!pointsRef.current) return;
    
    const pointsGroup = pointsRef.current as any;
    pointsGroup.children.forEach((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry) {
        const sphereIndex = child.userData?.index;
        if (sphereIndex !== undefined) {
          const material = child.material as THREE.MeshPhongMaterial;
          const isSelected = selected === sphereIndex;
          const isHovered = hoveredIndex === sphereIndex;
          
          if (isSelected) {
            material.color.setHex(0xff4444);
            material.opacity = 1.0;
            material.shininess = 100;
            material.emissive.setHex(0x220000);
          } else if (isHovered) {
            material.color.setHex(0xffdd00);
            material.opacity = 0.9;
            material.shininess = 60;
            material.emissive.setHex(0x111100);
          } else {
            material.color.setHex(0x4488ff);
            material.opacity = 0.85;
            material.shininess = 30;
            material.emissive.setHex(0x000000);
          }
        }
      }
    });
  }, [selected, hoveredIndex]);

  // Update connections when selection changes
  useEffect(() => {
    if (!sceneRef.current || !connectionsRef.current) return;
    
    // Remove old connections
    sceneRef.current.remove(connectionsRef.current);
    
    // Create new connections using cached PCA analysis
    if (pcaAnalysis) {
      createConnections(sceneRef.current, pcaAnalysis.coords, selectedNeighbors, selected);
    }
  }, [selectedNeighbors, vectors]);

  // Update arrows when selection changes
  useEffect(() => {
    if (!sceneRef.current || !arrowsRef.current) return;
    
    // Remove old arrows
    sceneRef.current.remove(arrowsRef.current);
    
    // Create new arrows using cached PCA analysis
    if (pcaAnalysis) {
      createVectorArrows(sceneRef.current, pcaAnalysis.coords, vectors, selected, dark);
    }
  }, [selected, dark, pcaAnalysis, vectors]);

  if (error) {
    return (
      <div className="h-[600px] flex items-center justify-center text-red-400">
        <div className="text-center">
          <div className="mb-2">⚠️ 3D Visualization Error</div>
          <div className="text-sm opacity-70">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[350px] sm:h-[450px] lg:h-[600px]">
      {/* Always render container so ref is available */}
      <div ref={containerRef} className="w-full h-full touch-manipulation" />
      
      {/* Loading overlay */}
      {vectors.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
          <div className="text-center text-white p-4">
            <div className="mb-2 text-sm sm:text-base">⏳ Waiting for Embeddings...</div>
            <div className="text-xs sm:text-sm opacity-70">The 3D visualization will appear once the tokenizer processes the words</div>
          </div>
        </div>
      )}
      
      {vectors.length > 0 && isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
          <div className="text-center text-white p-4">
            <div className="mb-2 text-sm sm:text-base">🔮 Loading 3D Space...</div>
            <div className="text-xs sm:text-sm opacity-70">Projecting {vectors.length} vectors into 3D</div>
          </div>
        </div>
      )}
      
      {/* Controls info - responsive */}
      {!isLoading && vectors.length > 0 && (
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-black/60 rounded-lg p-2 text-xs max-w-[250px] sm:max-w-none">
          <div className="text-white">
            <span className="hidden sm:inline">🖱️ Drag to rotate • 🖱️ Click points • 🖲️ Scroll to zoom</span>
            <span className="sm:hidden">👆 Drag to rotate • Tap points</span>
          </div>
          <div className="text-white/70 text-[10px] sm:text-xs">
            <span className="hidden sm:inline">🔴 Selected • 🟡 Hover • 🔵 Others</span>
            <span className="sm:hidden">🔴 Selected • 🔵 Others</span>
          </div>
        </div>
      )}
      
      {/* PCA Analysis info - responsive */}
      {!isLoading && pcaAnalysis && (
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-black/60 rounded-lg p-2 sm:p-3 text-xs max-w-[200px] sm:max-w-xs">
          <div className="text-white font-semibold mb-2">📊 3D PCA</div>
          <div className="space-y-1 text-white/90 text-[10px] sm:text-xs">
            <div className="flex justify-between">
              <span className="text-red-400">PC1:</span>
              <span>{(pcaAnalysis.varianceExplained[0] * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400">PC2:</span>
              <span>{(pcaAnalysis.varianceExplained[1] * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">PC3:</span>
              <span>{(pcaAnalysis.varianceExplained[2] * 100).toFixed(1)}%</span>
            </div>
            <div className="border-t border-white/20 pt-1 mt-2">
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>{(pcaAnalysis.totalVariance * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="text-white/60 mt-2 text-[9px] sm:text-[10px] leading-relaxed hidden sm:block">
            Closer points = more similar meanings. Each axis captures variance in 384D semantic space.
          </div>
        </div>
      )}
      
      {/* Hover tooltip - responsive */}
      {!isLoading && hoveredIndex !== null && (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 text-black px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold max-w-[250px] truncate">
          {words[hoveredIndex]}
        </div>
      )}
    </div>
  );
}