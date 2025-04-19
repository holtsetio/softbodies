import * as THREE from "three/webgpu";
import {
    float,
    If,
    length,
    max,
    min,
    mod,
    normalize,
    round,
    sub,
    time,
    vec2,
    vec3,
    vec4,
    floor,
    Fn,
    attribute,
    varying, transformNormalToView, smoothstep, positionView, positionWorld, step
} from "three/tsl";

import colorMapFile from './assets/rock_0005_color_1k.jpg';
import aoMapFile from './assets/rock_0005_ao_1k.jpg';
import normalMapFile from './assets/rock_0005_normal_opengl_1k.png';
import roughnessMapFile from './assets/rock_0005_roughness_1k.jpg';

const textureLoader = new THREE.TextureLoader();
const loadTexture = (file) => {
    return new Promise(resolve => {
        textureLoader.load(file, texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            resolve(texture);
        });
    });
}


class CollisionGeometry {
    constructor(physics) {
        this.physics = physics;
        this.object = new THREE.Object3D();
        //this.createFloorGeometry();
    }

    async createGeometry() {
        const [map, aoMap, normalMap, roughnessMap] = await Promise.all([loadTexture(colorMapFile), loadTexture(aoMapFile), loadTexture(normalMapFile), loadTexture(roughnessMapFile)]);

        const slope = 0.2;
        const stepLength = 5;
        const stepHeight = 3;
        const stepRadius = 0.5;
        const stepWidth = 250;
        const steps = 50;

        /*const wallBox = new RoundedBoxGeometry( 0.6, 20,  stepLength * 1.2, 4, 0.1);
        const wallMaterial = new THREE.MeshPhysicalNodeMaterial( { map,aoMap,roughnessMap,normalMap } );
        const wallMesh = new THREE.BatchedMesh( steps * 2, 24000, 36000, wallMaterial );
        wallMesh.castShadow = true;
        wallMesh.perObjectFrustumCulled = false;
        //wallMesh.receiveShadow = true;
        const wallGeometryId = wallMesh.addGeometry(wallBox);
        //this.object.add(wallMesh);
         */

        const positionArray = [];
        const normalArray = [];
        const uvArray = [];
        const uvFactor = 0.1;
        const indices = [];

        const vertexRows = [];
        let vertexId = 0;

        const beginAngle = Math.atan(slope);
        const radiusResolution = 6;
        let uvy = 0;

        const transformUv = (x,y) => {
            const r = new THREE.Vector2(x*uvFactor, y*uvFactor).rotateAround(new THREE.Vector2(), 0.6);
            return [r.x,r.y];
        };

        {
            const row = [];
            for (let x = 0; x < 2; x++) {
                const px = (x * 2 - 1) * 10;
                const py = 0;
                const pz = 0;
                positionArray.push(px, -py, -pz);
                normalArray.push(0, Math.cos(beginAngle), Math.sin(beginAngle));
                uvArray.push(...transformUv(px, 0));
                row.push(vertexId);
                vertexId++;
            }
            vertexRows.push(row);
            uvy += Math.cos(beginAngle) * (stepLength - stepRadius);
        }
        for (let i=0; i<steps; i++) {
            uvy += Math.cos(beginAngle) * (stepLength - stepRadius * 2);
            {
                const pivotx = (i + 1) * stepLength - stepRadius;
                const pivoty = i * stepHeight + (slope * stepLength) + (Math.cos(beginAngle) - Math.sin(beginAngle)) * stepRadius;
                for (let j = 0; j<radiusResolution; j++) {
                    const angle = beginAngle + (j / (radiusResolution - 1)) * (Math.PI * 0.5 - beginAngle);
                    const row = [];
                    for (let x = 0; x<2;x++) {
                        const px = (x * 2 - 1) * stepWidth * 0.5;
                        const py = pivoty - Math.cos(angle) * stepRadius;
                        const pz = pivotx + Math.sin(angle) * stepRadius;
                        positionArray.push(px,-py,pz);
                        normalArray.push(0, Math.cos(angle), Math.sin(angle));
                        uvArray.push(...transformUv(px, uvy));
                        row.push(vertexId);
                        vertexId++;
                    }
                    vertexRows.push(row);
                    uvy += ((Math.PI * 0.5 - beginAngle) * stepRadius) / (radiusResolution-1);
                }

            }
            uvy += (stepHeight - slope * stepLength) - Math.cos(beginAngle) * stepRadius * 2;
            {
                const pivotx = (i + 1) * stepLength + stepRadius;
                const pivoty = (i + 1) * stepHeight - (Math.cos(beginAngle) - Math.sin(beginAngle)) * stepRadius;
                for (let j = 0; j<radiusResolution; j++) {
                    const angle = (-Math.PI*0.5) - (j / (radiusResolution - 1)) * (Math.PI * 0.5 - beginAngle);
                    const row = [];
                    for (let x = 0; x<2;x++) {
                        const px = (x * 2 - 1) * stepWidth * 0.5;
                        const py = pivoty - Math.cos(angle) * stepRadius;
                        const pz = pivotx + Math.sin(angle) * stepRadius;
                        positionArray.push(px,-py,pz);
                        normalArray.push(0, -Math.cos(angle), -Math.sin(angle));
                        uvArray.push(...transformUv(px, uvy));
                        row.push(vertexId);
                        vertexId++;
                    }
                    vertexRows.push(row);
                    uvy += ((Math.PI * 0.5 - beginAngle) * stepRadius) / (radiusResolution-1);
                }
            }

            /*const boxInstancedId1 = wallMesh.addInstance(wallGeometryId);
            const boxInstancedId2 = wallMesh.addInstance(wallGeometryId);
            const matrix = new THREE.Matrix4().setPosition(-stepWidth * 0.5, -(9 + i * stepHeight), (i + 0.5) * stepLength);
            wallMesh.setMatrixAt(boxInstancedId1, matrix);
            matrix.setPosition(stepWidth * 0.5, -(9 + i * stepHeight), (i + 0.5) * stepLength);
            wallMesh.setMatrixAt(boxInstancedId2, matrix);*/

        }

        for (let y = 1; y<vertexRows.length; y++) {
            for (let x = 1; x<vertexRows[y].length; x++) {
                const a = vertexRows[y-1][x-1];
                const b = vertexRows[y-1][x];
                const c = vertexRows[y][x-1];
                const d = vertexRows[y][x];
                indices.push(c,b,a);
                indices.push(b,c,d);
            }
        }
        const positionBuffer = new THREE.BufferAttribute(new Float32Array(positionArray), 3, false);
        const normalBuffer = new THREE.BufferAttribute(new Float32Array(normalArray), 3, false);
        const uvBuffer = new THREE.BufferAttribute(new Float32Array(uvArray), 2, false);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('normal', normalBuffer);
        geometry.setAttribute('uv', uvBuffer);
        geometry.setIndex(indices);


        const material = new THREE.MeshPhysicalNodeMaterial({
            map,aoMap,roughnessMap, normalMap,
            transparent: true,
        });
        material.opacityNode = Fn(() => {
            const dist = positionWorld.xz.length();
            const projectedZ = positionView.z.mul(-1);
            const fog = smoothstep(30, 50, dist).oneMinus();
            return fog;
        })();


        const floor = new THREE.Mesh(geometry, material);
        floor.receiveShadow = true;
        floor.frustumCulled = false;
        floor.position.set(0, stepHeight * steps * 0.5, -stepLength * steps * 0.5);
        this.floor = floor;

        /*const ball = new THREE.Mesh(new THREE.SphereGeometry(1), material);
        ball.position.set(0,5,8);
        ball.castShadow = true;
        this.object.add(ball);*/


/*
        this.object.add(floor);
        const collider = (positionImmutable) => {
            const position = vec3(positionImmutable).toVar();
            const posZDiv = position.z.mul(0.2);
            const posZFloor = posZDiv.floor();
            const floorPosition = float(0.0).sub(posZFloor.mul(2.0)).toVar();
            const normal = vec3(0, 1, slope).normalize().toVar();
            const dist = position.y.sub(position.z.mul(slope).negate().add(floorPosition)).toVar();

            If( dist.lessThan( 0.0 ), () => {
                const wallDist = float(1).sub(posZDiv.sub(posZFloor)).negate().mul(2.0);
                If( wallDist.lessThan( 0.0 ).and( wallDist.greaterThan( dist ) ), () => {
                    dist.assign(wallDist);
                    normal.assign( vec3(0,0,1) );
                } );
            } );

            return vec4( normal, dist );
        };
        this.physics.addCollider(collider);*/


        /*const collider = (positionImmutable) => {
            const position = vec3(positionImmutable).toVar();
            return vec4( 0,1,0, position.y );
        };
        this.physics.addCollider(collider);*/

        /*
        const collider = (positionImmutable) => {
            const position = vec3(positionImmutable).toVar();
            position.addAssign(vec3(0,-20,10));
            const normal = position.normalize().negate();
            const length = position.length();
            const dist = float(25).sub(length).mul(step(100, length).oneMinus());
            return vec4( normal, dist );
        };
        this.physics.addCollider(collider);*/


        const collider = (positionImmutable) => {
            const position = vec3(positionImmutable).toVar();
            //position.addAssign(vec3(0,-20,10));
            const normal = position.normalize();
            const length = position.length();
            const dist = length.sub(5); //float(25).sub(length).mul(step(100, length).oneMinus());
            return vec4( normal, dist );
        };
        this.physics.addCollider(collider);
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 3), new THREE.MeshStandardNodeMaterial({color: new THREE.Color(0,0,0), metalness: 0.9, roughness:0.1}));
        ball.castShadow = true;
        ball.receiveShadow = true;
        this.object.add(ball);
    }

    update(delta, elapsed) {

    }
}
export default CollisionGeometry;
