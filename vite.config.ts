import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import AutoImport from 'unplugin-auto-import/vite'
import { resolve } from 'path' 
export default defineConfig({
  plugins: [
    react(),
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
  resolve: {//路径别名
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
})
