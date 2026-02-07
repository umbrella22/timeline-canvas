import { defineConfig } from "@rspress/core";
import { pluginPreview } from "@rspress/plugin-preview";
import { pluginLlms } from "@rspress/plugin-llms";
import mermaid from "rspress-plugin-mermaid";
import { pluginVue } from "@rsbuild/plugin-vue";
import { pluginSitemap } from '@rspress/plugin-sitemap';
import { pluginTwoslash } from '@rspress/plugin-twoslash';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/timeline-canvas/",
  root: "docs",
  title: "Timeline Canvas",
  description: "Canvas Timeline 使用文档",
  lang: "zh",
  head: [
    `<script>(function(){try{var k='timeline-canvas-docs-lang';var b='/timeline-canvas/';var p=location.pathname;var s=localStorage.getItem(k);if(s){return;}var isRoot=(p===b||p===b+'index.html');if(!isRoot){return;}var l=((navigator.languages&&navigator.languages[0])||navigator.language||'').toLowerCase();if(l.indexOf('en')===0){location.replace(b+'en/'+location.search+location.hash);}}catch(e){}})();</script>`,
  ],
  locales: [
    {
      lang: "zh",
      label: "中文",
      title: "Timeline Canvas",
      description: "Canvas Timeline 使用文档",
    },
    {
      lang: "en",
      label: "English",
      title: "Timeline Canvas",
      description: "Timeline Canvas documentation",
    },
  ],
  lastUpdated: true,
  route: {
    exclude: ["public/**/*"],
  },
  globalUIComponents: [path.join(__dirname, 'docs', 'public', 'components', 'AutoLocale.tsx')],
  themeConfig: {
    locales: [
      {
        lang: "zh",
        label: "中文",
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
            { text: "MCP 服务", link: "/guide/mcp" },
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
      {
        lang: "en",
        label: "English",
        nav: [
          { text: "Guide", link: "/en/guide/getting-started" },
          { text: "Config", link: "/en/guide/configuration" },
          { text: "Plugins", link: "/en/plugins/builtin" },
          { text: "API", link: "/en/api/timeline" },
          { text: "Playground", link: "/en/playground" },
        ],
        sidebar: {
          "/en/guide/": [
            { text: "Getting Started", link: "/en/guide/getting-started" },
            { text: "Installation & Build", link: "/en/guide/installation" },
            { text: "Usage & Examples", link: "/en/guide/usage" },
            { text: "Configuration", link: "/en/guide/configuration" },
            { text: "MCP Service", link: "/en/guide/mcp" },
          ],
          "/en/plugins/": [
            {
              text: "Plugin System",
              items: [
                { text: "Introduction", link: "/en/plugins/plugin-development/index" },
                { text: "Core API", link: "/en/plugins/plugin-development/api" },
                { text: "Lifecycle", link: "/en/plugins/plugin-development/lifecycle" },
                { text: "Event System", link: "/en/plugins/plugin-development/events" },
                { text: "Rendering", link: "/en/plugins/plugin-development/rendering" },
                { text: "Example Plugin", link: "/en/plugins/plugin-development/example" },
                { text: "Best Practices", link: "/en/plugins/plugin-development/best-practices" },
                { text: "Advanced Topics", link: "/en/plugins/plugin-development/advanced" },
              ],
            },
            {
              text: "Built-in Plugins",
              items: [
                { text: "Overview", link: "/en/plugins/builtin/index" },
                { text: "Context Menu", link: "/en/plugins/builtin/context-menu" },
                { text: "Event Tooltip", link: "/en/plugins/builtin/event-tooltip" },
                { text: "Light Theme", link: "/en/plugins/builtin/light-theme" },
                { text: "Dark Theme", link: "/en/plugins/builtin/dark-theme" },
                { text: "Performance Overlay", link: "/en/plugins/builtin/performance-overlay" },
                { text: "Event Media", link: "/en/plugins/builtin/event-media" },
                { text: "Mutex Guard", link: "/en/plugins/builtin/mutex-guard" },
              ],
            },
          ],
          "/en/advanced/": [{ text: "Performance & Monitoring", link: "/en/advanced/performance" }],
          "/en/api/": [
            {
              text: "Timeline API",
              items: [
                { text: "Overview", link: "/en/api/timeline/index" },
                { text: "Data Management", link: "/en/api/timeline/data-management" },
                { text: "View Control", link: "/en/api/timeline/view-control" },
                { text: "Plugin Management", link: "/en/api/timeline/plugin-management" },
                { text: "Event Callbacks", link: "/en/api/timeline/event-listeners" },
                { text: "Type Definitions", link: "/en/api/timeline/types" },
              ],
            },
          ],
        },
      },
    ],
  },
  plugins: [
    mermaid(),
    pluginLlms(),
    pluginTwoslash(),
    pluginSitemap({
      siteUrl: 'https://umbrella22.github.io/timeline-canvas/', // 替换为你的网站 URL
    }),
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
