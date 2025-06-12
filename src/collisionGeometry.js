import * as THREE from "three/webgpu";
import {
    vec3,
    vec4,
    Fn,
    smoothstep,
    positionView,
    positionWorld,
    time,
    mx_noise_vec3,
    mx_noise_float,
    uv,
    float,
    varying,
    vec2,
    transformNormalToView, attribute
} from "three/tsl";

import aoFile from './assets/others_0002_ao_2k.jpg';
import colorFile from './assets/others_0002_color_2k.jpg';
import metalnessFile from './assets/others_0035_metallic_2k.jpg';
import normalFile from './assets/others_0002_normal_opengl_2k.jpg';
import roughnessFile from './assets/others_0002_roughness_2k.jpg';

class CollisionGeometry {
    constructor(physics) {
        this.physics = physics;
        this.object = new THREE.Object3D();
    }

    async createGeometry() {
        /*const collider = (positionImmutable) => {
            const position = vec3(positionImmutable).toVar();
            //position.addAssign(vec3(0,-20,10));
            const normal = position.normalize();
            const length = position.length();
            const dist = length.sub(5); //float(25).sub(length).mul(step(100, length).oneMinus());
            return vec4( normal, dist );
        };
        this.physics.addCollider(collider);
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 3), new THREE.MeshStandardNodeMaterial(
            {color: new THREE.Color(1,1,1), metalness: 0.1, roughness:0.8}
        ));
        ball.castShadow = true;
        ball.receiveShadow = true;
        this.object.add(ball);*/

        const textureLoader = new THREE.TextureLoader();
        const texturePromises = [colorFile, aoFile, roughnessFile, metalnessFile, normalFile].map(file => {
            return new Promise(resolve => {
                textureLoader.load(file, texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    resolve(texture);
                });
            });
        });
        const [map, aoMap, roughnessMap, metalnessMap, normalMap] = await Promise.all(texturePromises);


        const noise = (position) => {
            const n = mx_noise_float(vec3(position.xy.mul(0.05), this.physics.uniforms.time.mul(0.1))).mul(8).sub(5);
            const slope = position.x.mul(0.2);
            //const slope2 = smoothstep(0, 20, position.y.abs()).mul(20);
            const slope2 = smoothstep(0, 50, position.y.abs()).mul(20);
            return n.add(slope).add(slope2);
        };
        const collider = (positionImmutable) => {
            const pos = vec3(positionImmutable).toVar();
            //position.addAssign(vec3(0,-20,10));

            const height = noise(pos.xz);
            const epsilon = vec2(0.001,0);
            const heightdx = noise(pos.xz.add(epsilon.xy));
            const heightdz = noise(pos.xz.add(epsilon.yx));
            const normal = vec3(height.sub(heightdx), epsilon.x, height.sub(heightdz)).normalize();

            const dist = pos.y.sub(height); //float(25).sub(length).mul(step(100, length).oneMinus());
            return vec4( normal, dist );
        };
        this.physics.addCollider(collider);

        const planeGeometry = new THREE.PlaneGeometry(1,1,200,200);
        const uvArray = planeGeometry.attributes.uv.array;
        for (let i = 0; i < uvArray.length; i++) {
            uvArray[i] *= 4;
        }

        const planeMaterial = new THREE.MeshPhysicalNodeMaterial({
            map, aoMap, roughnessMap, normalMap, //metalnessMap, //normalMap
            normalScale: new THREE.Vector2(3,3),
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.receiveShadow = true;
        this.object.add(plane);

        const vNormal = varying(vec3(0), "v_normalView");
        planeMaterial.positionNode = Fn(() => {
            const pos = uv().sub(2).toVar();
            pos.mulAssign(vec2(25, -25));
            const height = noise(pos);

            const epsilon = vec2(0.001,0);
            const heightdx = noise(pos.add(epsilon.xy));
            const heightdz = noise(pos.add(epsilon.yx));
            const normal = vec3(height.sub(heightdx), epsilon.x, height.sub(heightdz)).normalize();
            vNormal.assign(transformNormalToView(normal));

            return vec3(pos.x,height,pos.y);
        })();
        //planeMaterial.uvNode = attribute("uv").mul(10);
    }

    update(delta, elapsed) {

    }

    dispose() {

    }
}
export default CollisionGeometry;
