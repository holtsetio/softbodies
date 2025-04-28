import {struct, instancedArray} from "three/tsl";

const TYPES = {
    int: { size: 1, alignment: 1, isFloat: false },
    uint: { size: 1, alignment: 1, isFloat: false },
    float: { size: 1, alignment: 1, isFloat: true },

    vec2: { size: 2, alignment: 2, isFloat: true },
    ivec2: { size: 2, alignment: 2, isFloat: false },
    uvec2: { size: 2, alignment: 2, isFloat: false },

    vec3: { size: 3, alignment: 4, isFloat: true },
    ivec3: { size: 3, alignment: 4, isFloat: false },
    uvec3: { size: 3, alignment: 4, isFloat: false },

    vec4: { size: 4, alignment: 4, isFloat: true },
    ivec4: { size: 4, alignment: 4, isFloat: false },
    uvec4: { size: 4, alignment: 4, isFloat: false },

    mat2: { size: 4, alignment: 2, isFloat: true },
    mat3: { size: 12, alignment: 4, isFloat: true },
    mat4: { size: 16, alignment: 4, isFloat: true },
};

export class StructuredArray {
    structNode = null;
    buffer = null;
    layout = null;
    structSize = 0;

    constructor(layout, length, label) {
        this.layout = this._parse(layout);
        this.length = length;
        this.structNode = struct(this.layout);
        this.floatArray = new Float32Array(this.structSize * this.length);
        this.intArray = new Int32Array(this.floatArray.buffer);
        this.buffer = instancedArray(this.floatArray, this.structNode).label(label);
    }

    set(index, element, value) {
        const member = this.layout[element];
        if (!member) {
            return console.error("Unknown element '" + element + "'");
        }
        const offset = index * this.structSize + member.offset;
        const array = member.isFloat ? this.floatArray : this.intArray;

        if (member.size === 1) {
            if (typeof value !== 'number') {
                return console.error("Expected a Number value for element '" + element + "'");
            }
            array[offset] = value;
        }
        if (member.size > 1) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                const obj = value;
                value = [obj.x, obj.y || 0, obj.z || 0, obj.w || 0];
            }
            if (!Array.isArray(value) || value.length < member.size) {
                return console.error("Expected an array of length " + member.size + " for element '" + element + "'");
            }
            for (let i = 0; i < member.size; i++) {
                array[offset + i] = value[i];
            }
        }
    }

    get(index, element) {
        return this.buffer.element(index).get(element);
    }

    _parse(layout) {
        let offset = 0;
        const parsedLayout = {};

        const keys = Object.keys(layout);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            let member = layout[key];
            if (typeof member === 'string' || member instanceof String) {
                member = { type: member };
            }
            const type = member.type;
            if (!TYPES[type]) {
                return console.error("Unknown type '" + type + "'");
            }
            const { size, alignment, isFloat } = TYPES[type];
            member.size = size;
            member.isFloat = isFloat;

            const rest = offset % alignment;
            if (rest !== 0) {
                offset += (alignment - rest);
            }
            member.offset = offset;
            offset += size;

            parsedLayout[key] = member;
        }

        const rest = offset % 4;
        if (rest !== 0) {
            offset += (4 - rest);
        }

        this.structSize = offset;
        return parsedLayout;
    }
};