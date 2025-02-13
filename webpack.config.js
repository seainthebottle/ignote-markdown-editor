const path = require("path");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
//const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
    mode: "production", // Vite의 build 모드와 동일하게 설정
    entry: "./src/index.js", // 엔트리 파일

    output: {
        path: path.resolve("modules"), // 빌드 결과 디렉토리
        filename: "ignote-markdown-editor.js", // 파일명
        //library: "IgnoteMarkdownEditor",
        libraryTarget: "umd", // UMD 포맷 추가
        globalObject: "this",
        libraryExport: "default",
        iife: true,
        // module: true, // Webpack 5 이상에서 ES 모듈 지원
        clean: true, // 기존 빌드 파일 정리
    },

    // experiments: {
    //     outputModule: true, // ES 모듈 활성화
    // },

    externals: [], // Vite의 `rollupOptions.external` 대응 (필요시 추가)

    // optimization: {
    //     minimize: true,
    //     minimizer: [new TerserPlugin()], // 코드 압축 적용
    // },

    module: {
        rules: [
            {
                test: /\.js$/,
                use: "babel-loader",
            },
            {
                test: /\.ts$/,
                use: "ts-loader",
            },
        ],
    },

    resolve: {
        modules: [path.join(__dirname, "src"), "node_modules"],
        extensions: [".js", ".ts", ".tsx"],
        plugins: [new TsconfigPathsPlugin()], // tsconfig.json 경로 매핑 지원,
        fallback: {
            "fs": false,
            "path": false,
            "os": false
        }
    },
};
