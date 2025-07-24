import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import AutoImport from 'unplugin-auto-import/vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts';
export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: 'tsconfig.app.json',
      insertTypesEntry: true, // 生成类型入口
      exclude: ['**/__tests__/**'], // 排除测试文件
      outDir: 'dist/types', // 类型输出目录 
    }),
    AutoImport({
      imports: [
        'react',
        {
          'react': ['StrictMode']
        },
        {
          'react-dom/client': ['createRoot'], // 明确指定自动导入 createRoot
        },
        'react-router-dom',
      ],
      dts: true, // 生成 TypeScript 声明文件
      eslintrc: {
        enabled: true, // 生成 ESLint 配置，避免 ESLint 报错
        filepath: './.eslintrc-auto-import.json',
        globalsPropValue: true,
      },
      dirs: [
        "./src/api/**",
        "./src/utils/**",
      ]
    })
  ],
  build: {
    lib: {
      // **组件库入口文件**（必要）
      entry: resolve(__dirname, 'src/components/UploadContainer/index.tsx'),
      // **库名称**（必要，全局变量名）
      name: 'QUploadContainer',
      fileName: (format: unknown) => `q-upload-container.${format}.js`, // 输出文件名
      formats: ['es', 'umd'] // 打包格式
    },
    // Rollup 配置
    rollupOptions: {
      // 外部化依赖（必需）
      external: ['react', 'react-dom'],

      output: {
        // UMD格式的全局变量名映射
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },

        // 保留模块导出名称 
        preserveModules: false,

        // 资源文件命名
        assetFileNames: 'assets/[name][extname]'
      },
    },
    // 清空输出目录（推荐）
    emptyOutDir: true,

    // 生成sourcemap（调试用）
    sourcemap: true
  },
  resolve: {//路径别名
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
})
