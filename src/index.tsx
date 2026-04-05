import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Refine } from "@refinedev/core";
import { ErrorComponent } from "@refinedev/antd";
import { ConfigProvider, App as AntdApp } from "antd";
import routerProvider, {
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router-v6";
import { dataProvider } from "@refinedev/supabase";
import { authProvider } from "./authProvider";
import { supabaseClient } from "./utils";

import "@refinedev/antd/dist/reset.css";
import { roiTheme } from "./theme";
import { Dashboard } from "./pages/Dashboard";
import { Technicians } from "./pages/Technicians";
import { Schedule } from "./pages/Schedule";
import { DailyEntry } from "./pages/DailyEntry";
import { TechPerformance } from "./pages/TechPerformance";
import { ShopSelector } from "./pages/ShopSelector";
import CustomLayout from "./components/layout";

const App = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ConfigProvider theme={roiTheme}>
        <AntdApp>
          <Refine
            dataProvider={dataProvider(supabaseClient)}
            authProvider={authProvider}
            routerProvider={routerProvider}
            resources={[]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
            }}
          >
            <Routes>
              <Route element={<CustomLayout />}>
                <Route index element={<ShopSelector />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/techs" element={<Technicians />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/daily-entry" element={<DailyEntry />} />
                <Route path="/tech-performance" element={<TechPerformance />} />
                <Route path="*" element={<ErrorComponent />} />
              </Route>
            </Routes>
            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}