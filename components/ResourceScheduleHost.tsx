import { useEffect, useRef } from "react";
import { createApp, type App } from "vue";
import { ResourceSchedule } from "./ResourceSchedule";

/**
 * React 宿主：仅负责 Vue app 的 createApp/unmount。
 * SSR 阶段不执行 effect，Vue 实例只在浏览器挂载时创建。
 * lang 跟随文档站点页面传入，透传给 Vue 组件做界面文案双语化。
 */
export function ResourceScheduleHost({ lang }: { lang?: "zh" | "en" }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<App | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const app = createApp(ResourceSchedule, { lang });
    app.mount(containerRef.current);
    appRef.current = app;
    return () => {
      app.unmount();
      appRef.current = null;
    };
  }, []);

  return <div ref={containerRef} />;
}
