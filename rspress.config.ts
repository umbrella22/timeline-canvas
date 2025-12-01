import { defineConfig } from "rspress/config";
import { pluginPreview } from "@rspress/plugin-preview";
import { pluginVue } from "@rsbuild/plugin-vue";

export default defineConfig({
  base: "/timeline-canvas/",
  root: "docs",
  title: "Timeline Canvas",
  description: "Canvas Timeline 使用文档",
  themeConfig: {
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "配置", link: "/guide/configuration" },
      { text: "插件", link: "/plugins/builtin" },
      { text: "API", link: "/api/timeline" },
      { text: "演练场", link: "/playground" },
    ],
    sidebar: {
      "/guide/": [
        { text: "快速开始", link: "/guide/getting-started" },
        { text: "安装与构建", link: "/guide/installation" },
        { text: "使用与示例", link: "/guide/usage" },
        { text: "配置项", link: "/guide/configuration" },
      ],
      "/plugins/": [
        { text: "内置插件", link: "/plugins/builtin" },
        { text: "插件开发", link: "/plugins/plugin-development" },
      ],
      "/advanced/": [{ text: "性能与监控", link: "/advanced/performance" }],
      "/api/": [{ text: "Timeline API", link: "/api/timeline" }],
    },
  },
  plugins: [
    pluginPreview({
      iframeOptions: {
        customEntry: ({ entryCssPath, demoPath }) => {
          if (demoPath.endsWith(".vue")) {
            return `
              import { createApp } from 'vue';
              import App from ${JSON.stringify(demoPath)};
              import ${JSON.stringify(entryCssPath)};
              createApp(App).mount('#root');
              `;
          }
          return `
            import { render } from 'react-dom';
            import ${JSON.stringify(entryCssPath)};
            import Demo from ${JSON.stringify(demoPath)};
            render(<Demo />, document.getElementById('root'));
            `;
        },
        builderConfig: {
          plugins: [pluginVue()],
        },
      },
      previewLanguages: ["jsx", "tsx", "vue"],
    }),
  ],
});
