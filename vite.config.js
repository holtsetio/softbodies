import { defineConfig } from 'vite'
import tslOperatorPlugin from 'vite-plugin-tsl-operator'

export default defineConfig({
    assetsInclude: ['**/*.hdr'],
    server: {
        port: 1234,
    },
    plugins: [
        tslOperatorPlugin({logs:false})
        //.. other plugins
    ]
});