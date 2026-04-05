import { theme } from "antd";

export const roiTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#2E7D32",        // Green accent
    colorInfo: "#0284C7",           // Electric blue
    colorSuccess: "#2E7D32",        // Green
    colorWarning: "#E65100",        // Orange
    colorError: "#C62828",          // Red
    colorBgBase: "#0F1215",         // Dark background
    colorBgContainer: "#1A1E23",    // Card background
    colorText: "#E5E7EB",           // Light text
    colorTextSecondary: "#9CA3AF",  // Gray text
    borderRadius: 8,
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Layout: {
      headerBg: "#0F1215",
      siderBg: "#0F1215",
      bodyBg: "#0F1215",
    },
    Card: {
      colorBgContainer: "#1A1E23",
    },
    Button: {
      primaryColor: "#FFFFFF",
    },
    Typography: {
      colorText: "#E5E7EB",
    },
  },
};