import dat from "dat.gui/src/dat";
import chroma from "chroma-js";
import {noise3D} from "./common/noise";

dat.GUI.prototype.addLog = function (object, property, min, max, step) {
    const num_controller = this.add(object, property, min, max, step);
    const minv = Math.log(min);
    const maxv = Math.log(max);
    const scale = (maxv - minv) / (max - min);

    const onChangeFunc = num_controller.onChange;
    num_controller.onChange = (func) => {
        onChangeFunc(value => {
            const ret = Math.exp(minv + scale * (value - min));
            object[property] = ret;
            func && func(ret);
        })
    }
    num_controller.onChange();


    const updateDisplay = num_controller.updateDisplay;
    num_controller.updateDisplay = () => {
        updateDisplay();
        const invertLog = (Math.log(num_controller.getValue()) - minv) / scale + min;
        const pct = (invertLog - min) / (max - min);
        num_controller.__foreground.style.width = pct * 100 + '%';
    }

    num_controller.updateDisplay();
    return num_controller;
}

class Conf {
    gui = null;


    sheen = 1.0;
    sheenRoughness = 0.1;
    sheenColor = 0xFF6400;
    clothWidth = 0.05;


    light1 = null;
    light2 = null;
    light3 = null;
    light4 = null;
    lightSeed = 0;

    animateLights = true;

    bloom = true;
    bloomStrength = 0.05;
    bloomRadius = 0.4;
    bloomThreshold = 0;

    constructor() {
        const gui = new dat.GUI()
        this.gui = gui;

        const materialFolder = gui.addFolder(`Material`);
        materialFolder.add(this, "clothWidth", 0, 0.1, 0.005);
        materialFolder.add(this, "sheen", 0, 1, 0.01);
        materialFolder.add(this, "sheenRoughness", 0, 1, 0.01);
        materialFolder.addColor(this, "sheenColor");

        this.randomizeLights();
        const lightsFolder = gui.addFolder(`Lights`);
        lightsFolder.addColor(this, "light1");
        lightsFolder.addColor(this, "light2");
        lightsFolder.addColor(this, "light3");
        lightsFolder.addColor(this, "light4");
        lightsFolder.add(this, "randomizeLights");
        lightsFolder.add(this, "animateLights");
        this.lightsFolder = lightsFolder;


        const postProcessingFolder = gui.addFolder(`Post Processing`);
        postProcessingFolder.add(this, "bloom").onChange((value) => value ? this.bloomFolder.show() : this.bloomFolder.hide());
        this.bloomFolder = postProcessingFolder.addFolder(`Bloom`);
        this.bloomFolder.add(this, "bloomStrength", 0, 1, 0.01);
        this.bloomFolder.add(this, "bloomRadius", 0, 1, 0.01);
        this.bloomFolder.add(this, "bloomThreshold", 0, 1, 0.01);
    }

    randomizeLights() {
        this.light1 = chroma.random().hex();
        this.light2 = chroma.random().hex();
        this.light3 = chroma.random().hex();
        this.light4 = chroma.random().hex();
        this.lightSeed = Math.random() * 100;
        this.gui.updateDisplay();
    }

    update() {
        if (this.animateLights) {
            const t = (performance.now() / 1000.0) * 0.03;
            const lights = ["light1", "light2", "light3", "light4"];
            lights.forEach((light, index) => {
               const h = noise3D(this.lightSeed + index * 5, 0.2, t) * 360;
               const s = noise3D(this.lightSeed + index * 5, 3.2, t) * 0.2 + 0.2;
               const l = noise3D(this.lightSeed + index * 5, 6.2, t) * 0.2 + 0.8;
               this[light] = chroma.hsl(h,s,l).hex();
            });
            this.lightsFolder.updateDisplay();
        }
    }

}
export const conf = new Conf();