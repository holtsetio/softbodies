import {Pane} from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import mobile from "is-mobile";

const isMobile = mobile();

class Conf {
    gui = null;

    wireframe = false;

    stepsPerSecond = 180;

    bodies = (isMobile ? 30 : 30);

    maxBodies = 50;

    scene = 'skulls';

    roughness = 0.1;
    transmission = 0.9;
    thickness = 3.2;

    constructor() {

    }

    init() {
        const gui = new Pane()
        gui.registerPlugin(EssentialsPlugin);

        const stats = gui.addFolder({
            title: "stats",
            expanded: false,
        });
        this.fpsGraph = stats.addBlade({
            view: 'fpsgraph',
            label: 'fps',
            rows: 2,
        });

        const settings = gui.addFolder({
            title: "settings",
            expanded: false,
        });

        const materialSettings = settings.addFolder({
            title: "material settings",
            expanded: false,
        });
        materialSettings.addBinding(this, "roughness", { min: 0, max: 1, step: 0.01 });
        materialSettings.addBinding(this, "transmission", { min: 0, max: 1, step: 0.01 });
        materialSettings.addBinding(this, "thickness", { min: 0, max: 10, step: 0.01 });


        const scenes = {
            spheres: { min: 1, max: 50, default: 30, text: "only spheres" },
            skulls: { min: 1, max: 50, default: 30, text: "spheres + skulls" },
            mixed: { min: 1, max: 50, default: 30, text: "mixed" },
        };

        settings.addBlade({
            view: 'list',
            label: 'scene',
            options: Object.keys(scenes).map(key => ({ ...scenes[key], value: key })),
            value: 'skulls',
        }).on('change', (ev) => {
            const params = scenes[ev.value];
            this.bodies = Math.round(params.default * (isMobile ? 0.3 : 1.0));
            this.maxBodies = params.max;
            this.bodiesBinding.min = params.min;
            this.bodiesBinding.max = params.max;
            this.scene = ev.value;
            gui.refresh();
        });

        this.bodiesBinding = settings.addBinding(this, "bodies", { min: 1, max: this.maxBodies, step: 1 });
        settings.addBinding(this, "stepsPerSecond", { min: 120, max: 300, step: 60 });
        //settings.addBinding(this, "wireframe");

        this.settings = settings;
        this.gui = gui;
    }

    update() {
    }

    begin() {
        this.fpsGraph.begin();
    }
    end() {
        this.fpsGraph.end();
    }
}
export const conf = new Conf();