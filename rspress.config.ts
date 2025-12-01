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
        {
          text: "插件机制",
          items: [
            { text: "介绍", link: "/plugins/plugin-development/index" },
            { text: "核心 API", link: "/plugins/plugin-development/api" },
            { text: "生命周期", link: "/plugins/plugin-development/lifecycle" },
            { text: "事件系统", link: "/plugins/plugin-development/events" },
            { text: "渲染机制", link: "/plugins/plugin-development/rendering" },
            { text: "编写插件", link: "/plugins/plugin-development/example" },
            {
              text: "最佳实践",
              link: "/plugins/plugin-development/best-practices",
            },
            { text: "高级主题", link: "/plugins/plugin-development/advanced" },
          ],
        },
        {
          text: "内置插件",
          items: [
            { text: "总览", link: "/plugins/builtin/index" },
            { text: "右键菜单", link: "/plugins/builtin/context-menu" },
            { text: "事件提示", link: "/plugins/builtin/event-tooltip" },
            { text: "亮色主题", link: "/plugins/builtin/light-theme" },
            { text: "暗色主题", link: "/plugins/builtin/dark-theme" },
            {
              text: "性能监控",
              link: "/plugins/builtin/performance-overlay",
            },
            { text: "事件媒体", link: "/plugins/builtin/event-media" },
            { text: "事件互斥", link: "/plugins/builtin/mutex-guard" },
          ],
        },
      ],
      "/advanced/": [{ text: "性能与监控", link: "/advanced/performance" }],
      "/api/": [
        {
          text: "Timeline API",
          items: [
            { text: "总览", link: "/api/timeline/index" },
            { text: "数据管理", link: "/api/timeline/data-management" },
            { text: "视图控制", link: "/api/timeline/view-control" },
            { text: "插件管理", link: "/api/timeline/plugin-management" },
            { text: "事件监听", link: "/api/timeline/event-listeners" },
            { text: "类型定义", link: "/api/timeline/types" },
          ],
        },
      ],
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
