import * as THREE from "three/webgpu";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader";

const processTetGeometry = (tetVertsRaw, tetIdsRaw) => {
    let vertices = [];
    let tets = [];
    const addVertex = (x,y,z) => {
        const id = vertices.length;
        const vertex = new THREE.Vector3(Number(x),Number(y),Number(z));
        vertex.id = id;
        vertex.tetCount = 0;
        vertices.push(vertex);
    }

    const addTet = (v0,v1,v2,v3) => {
        const id = tets.length;
        const center = v0.clone().add(v1).add(v2).add(v3).divideScalar(4);
        const tet = {id,v0,v1,v2,v3,center};
        tets.push(tet);
    }


    for (let i=0; i < tetVertsRaw.length; i += 3) {
        const x = tetVertsRaw[i];
        const y = tetVertsRaw[i+1];
        const z = tetVertsRaw[i+2];
        addVertex(x,y,z);
    }

    for (let i=0; i < tetIdsRaw.length; i += 4) {
        const a = vertices[tetIdsRaw[i]-1];
        const b = vertices[tetIdsRaw[i+1]-1];
        const c = vertices[tetIdsRaw[i+2]-1];
        const d = vertices[tetIdsRaw[i+3]-1];
        a.tetCount++;
        b.tetCount++;
        c.tetCount++;
        d.tetCount++;
        addTet(a,b,c,d);
    }

    vertices = vertices.filter(v => v.tetCount > 0);
    vertices.forEach((v, index) => { v.id = index; });
    const tetVerts = vertices.map(v => [v.x,v.y,v.z]).flat();
    const tetIds = tets.map(t => [t.v0.id,t.v1.id,t.v2.id,t.v3.id]).flat();

    return { tetVerts, tetIds, vertices, tets };
}

const processMsh = (msh) => {
    const vertexRegex = /\$Nodes\n\d+\n(.+)\$EndNodes/gms;
    const vertexMatch = vertexRegex.exec(msh);
    const vertexRepRegex = /\d+\s(.+)\n/gm;
    const tetVertsRaw = vertexMatch['1'].replace(vertexRepRegex, '$1 ').trim().split(' ').map(v => Number(v)).map(v => Math.round(v * 10000) / 10000);

    const tetRegex = /\$Elements\n\d+\n(.+)\$EndElements/gms;
    const tetMatch = tetRegex.exec(msh);
    const tetRepRegex = /.+(\s\d+\s\d+\s\d+\s\d+)\s\n/gm;
    const tetIdsRaw = tetMatch['1'].replace(tetRepRegex, '$1').trim().split(' ').map(v => Number(v));
    return processTetGeometry(tetVertsRaw, tetIdsRaw);
}

const processGeometry = (geometry, tets) => {
    const positionAttribute = geometry.getAttribute("position");
    const vertexCount = positionAttribute.count;
    const positionArray = positionAttribute.array;
    const normalArray = geometry.getAttribute("normal").array;
    const uvArray = geometry.getAttribute("uv").array;
    const indexArray = geometry.index.array;

    const tetIdArray = new Uint32Array(vertexCount);
    //const vertexIdArray = new Uint32Array(vertexCount*4);
    const tetBaryCoordsArray = new Float32Array(vertexCount * 3);

    const findClosestTet = (vertex) => {
        let minDist = 1e9;
        let closestTet = null;
        for (let i=0; i<tets.length; i++) {
            const tet = tets[i];
            const dist = vertex.distanceTo(tet.center);
            if (dist < minDist) {
                minDist = dist;
                closestTet = tet;
            }
        }
        return closestTet;
    }

    const getMatrixInverse = (tet) => {
        const { v0,v1,v2,v3 } = tet;
        const a = v1.clone().sub(v0);
        const b = v2.clone().sub(v0);
        const c = v3.clone().sub(v0);
        const matrix = new THREE.Matrix3(a.x,b.x,c.x,a.y,b.y,c.y,a.z,b.z,c.z);
        return matrix.clone().invert();
    }

    for (let i=0; i<vertexCount; i++) {
        const x = positionArray[i*3+0];
        const y = positionArray[i*3+1];
        const z = positionArray[i*3+2];
        const vertex = new THREE.Vector3(x,y,z);
        const closestTet = findClosestTet(vertex);
        tetIdArray[i] = closestTet.id;
        /*vertexIdArray[i*4+0] = closestTet.v0.id;
        vertexIdArray[i*4+1] = closestTet.v1.id;
        vertexIdArray[i*4+2] = closestTet.v2.id;
        vertexIdArray[i*4+3] = closestTet.v3.id;*/
        const baryCoords = vertex.clone().sub(closestTet.v0).applyMatrix3(getMatrixInverse(closestTet));
        tetBaryCoordsArray[i * 3 + 0] = baryCoords.x;
        tetBaryCoordsArray[i * 3 + 1] = baryCoords.y;
        tetBaryCoordsArray[i * 3 + 2] = baryCoords.z;
    }
    /*const tetIdBuffer = new THREE.BufferAttribute(tetIdArray, 1, false);
    const vertexIdsBuffer = new THREE.BufferAttribute(vertexIdArray, 4, false);
    const tetBaryCoordsBuffer = new THREE.BufferAttribute(tetBaryCoordsArray, 3, false);
    geometry.setAttribute("tetId", tetIdBuffer);
    geometry.setAttribute("vertexIds", vertexIdsBuffer);
    geometry.setAttribute("tetBaryCoords", tetBaryCoordsBuffer);*/
    //obj.children[0].geometry.computeVertexNormals();

    const processedModel = {
        attachedTets: [...tetIdArray],
        baryCoords: [...tetBaryCoordsArray].map(v=>Math.round(v*10000)/10000),
        positions: [...positionArray].map(v=>Math.round(v*10000)/10000),
        normals: [...normalArray].map(v=>Math.round(v*10000)/10000),
        uvs: [...uvArray].map(v=>Math.round(v*10000)/10000),
        indices: [...indexArray],
    };
    return processedModel;
};

const processObj = (obj, tets) => {
    const objectRaw = new OBJLoader().parse(obj);
    const geometry = BufferGeometryUtils.mergeVertices(objectRaw.children[0].geometry);
    return processGeometry(geometry, tets);
}

const print = (model) => {
    let str = "const model = { \n";
    Object.keys(model).forEach((key) => {
        str += " " + key + ": [";
        str += model[key].join(",")
        str += "],\n"
    });
    str += "};\n";
    str += "export default model;"
    console.log(str);
}

export const loadModel = (msh, obj) => {
    const { tetVerts, tetIds, vertices, tets } = processMsh(msh);
    const { attachedTets, baryCoords, normals, uvs, positions, indices} = processObj(obj, tets);
    const model = { tetVerts, tetIds, attachedTets, baryCoords, normals, uvs, positions, indices };
    print(model);
    return model;
};

export const loadModelWithGeo = (msh, geo) => {
    const { tetVerts, tetIds, vertices, tets } = processMsh(msh);
    const { attachedTets, baryCoords, normals, uvs, positions, indices} = processGeometry(geo, tets);
    const model = { tetVerts, tetIds, attachedTets, baryCoords, normals, uvs, positions, indices };
    print(model);
    return model;
};

export const generateTube = () => {
    const radius = 0.25*0.5;
    const length = 2.5*10*0.5*0.5*1;
    const segments = 5*10*0.5*1;
    const tetVertsRaw = [];
    const tetIdsRaw = [];

    const rr = radius;
    for (let x=0; x<=segments; x++) {
        const px = x * (length/segments) - length * 0.5;
        tetVertsRaw.push( rr, -px, -rr);
        tetVertsRaw.push( rr, -px, rr);
        tetVertsRaw.push( -rr, -px, rr);
        tetVertsRaw.push( -rr, -px, -rr);
    }
    tetVertsRaw.push( 0, (length*0.5 + radius), 0);
    const bottomVert = tetVertsRaw.length / 3;
    tetVertsRaw.push( 0, -(length*0.5 + radius), 0);
    const topVert = tetVertsRaw.length / 3;

    for (let x=0; x<segments; x++) {
        const v = (n) => x*4+n;
        tetIdsRaw.push(v(1), v(4), v(8), v(7));
        tetIdsRaw.push(v(1), v(8), v(5), v(7));
        tetIdsRaw.push(v(1), v(5), v(6), v(7));
        tetIdsRaw.push(v(1), v(6), v(2), v(7));
        tetIdsRaw.push(v(1), v(2), v(3), v(7));
        tetIdsRaw.push(v(1), v(3), v(4), v(7));
    }
    tetIdsRaw.push(bottomVert, 1,2,3);
    tetIdsRaw.push(bottomVert, 1,3,4);
    tetIdsRaw.push(topVert, segments*4+1,segments*4+2,segments*4+3);
    tetIdsRaw.push(topVert, segments*4+1,segments*4+3,segments*4+4);

    //const geometry = new THREE.CylinderGeometry( radius, radius, length, 8, segments );
    const geometry = new THREE.CapsuleGeometry(radius, length, 4, 8, segments );
    //geometry.rotateZ(Math.PI/2);
    const { tetVerts, tetIds, vertices, tets } = processTetGeometry(tetVertsRaw, tetIdsRaw);
    const { attachedTets, baryCoords, normals, uvs, positions, indices} = processGeometry(geometry, tets);
    const model = { tetVerts, tetIds, attachedTets, baryCoords, normals, uvs, positions, indices };
    print(model);
    return model;
}