import dat from "dat.gui/src/dat";

class Conf {
    gui = null;

    showTetrahedrons = false;

    constructor() {
        const gui = new dat.GUI()
        this.gui = gui;

        this.gui.add(this, "showTetrahedrons");
    }

    update() {
    }

}
export const conf = new Conf();