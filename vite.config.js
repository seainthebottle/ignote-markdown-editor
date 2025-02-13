import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tsconfig from "./tsconfig.json";  

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    extensions: [".cjs", ".js"] 
  },
  build: {
    lib: {
      entry: "src/index.js",  // 엔트리 파일
      name: "IgnoteMarkdownEditor", // 모듈 이름
      fileName: (format) => `ignote-markdown-editor.js`,
      //fileName: (format) => `ignote-markdown-editor.${format}.js`,
      formats: ["es"]
    },
    rollupOptions: {
      external: [], // 외부 종속성 (예: ["react", "vue"] 필요시 추가)
      output: {
        globals: {},
        dir: "modules"
      }
    },
    esbuild: {
      tsconfigRaw: tsconfig,  // tsconfig.json 직접 적용
    }
  }
});
