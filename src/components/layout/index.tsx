import React, { useState, useEffect } from "react";
import { Layout as AntdLayout, Menu, Button, Avatar, Dropdown, Space, Typography } from "antd";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useLogout, useGetIdentity } from "@refinedev/core";
import {
  DashboardOutlined,
  ScheduleOutlined,
  FormOutlined,
  TeamOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ShopOutlined,
  LineChartOutlined,
  SettingOutlined,
} from "@ant-design/icons";

const { Header, Sider, Content } = AntdLayout;

interface User {
  id?: string;
  name?: string;
  email?: string;
  avatar?: string;
}

const CustomLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [shopName, setShopName] = useState<string>("No Shop");
  const location = useLocation();
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const { data: user } = useGetIdentity<User>();

  const updateShopName = () => {
    const name = localStorage.getItem("currentShopName");
    if (name) {
      setShopName(name);
    } else {
      setShopName("No Shop");
    }
  };

  useEffect(() => {
    updateShopName();
    window.addEventListener("storage", updateShopName);
    window.addEventListener("shopChanged", updateShopName);
    return () => {
      window.removeEventListener("storage", updateShopName);
      window.removeEventListener("shopChanged", updateShopName);
    };
  }, []);

  const handleSwitchShop = () => {
    navigate("/");
  };

  const menuItems = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Dashboard</Link>,
    },
    {
      key: "/schedule",
      icon: <ScheduleOutlined />,
      label: <Link to="/schedule">Schedule</Link>,
    },
    {
      key: "/daily-entry",
      icon: <FormOutlined />,
      label: <Link to="/daily-entry">Daily Entry</Link>,
    },
    {
      key: "/tech-performance",
      icon: <LineChartOutlined />,
      label: <Link to="/tech-performance">Tech Performance</Link>,
    },
    {
      key: "/techs",
      icon: <TeamOutlined />,
      label: <Link to="/techs">Technicians</Link>,
    },
    {
      key: "/settings",
      icon: <SettingOutlined />,
      label: <Link to="/settings">Shop Settings</Link>,
    },
  ];

  const selectedKey = location.pathname;
  const displayName = user?.name || user?.email || "User";
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div
      style={{
        backgroundImage: "url('/images/roi_bg_v1.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        width: "100%",
      }}
    >
      <AntdLayout style={{ minHeight: "100vh", background: "transparent" }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width="15%"
          collapsedWidth="80px"
          style={{
            backgroundImage: "url('/images/sidebar_1.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            borderRight: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              marginBottom: "16px",
            }}
          >
            <img
              src="/images/roi_brand.png"
              alt="ROI"
              style={{
                width: collapsed ? "60px" : "100%",
                maxWidth: collapsed ? "60px" : "calc(100% - 32px)",
                height: "auto",
                display: "block",
                margin: "0 auto",
                transform: "scale(1.15)",
              }}
              onError={(e) => {
                console.error("Sidebar logo failed to load");
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div
            style={{
              textAlign: "center",
              padding: "12px",
              marginBottom: "16px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <Button
              type="text"
              icon={<ShopOutlined />}
              onClick={handleSwitchShop}
              style={{
                color: "#E5E7EB",
                fontSize: collapsed ? "12px" : "14px",
                padding: collapsed ? "4px 8px" : "8px 16px",
                height: "auto",
                width: "100%",
              }}
            >
              {!collapsed && (
                <span>
                  <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Current Shop</div>
                  <div style={{ fontWeight: "bold" }}>{shopName}</div>
                </span>
              )}
            </Button>
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            style={{
              background: "transparent",
              borderRight: "none",
            }}
          />
        </Sider>
        <AntdLayout style={{ background: "transparent" }}>
          <Header
            style={{
              padding: 0,
              background: "transparent",
              height: "auto",
              lineHeight: "normal",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
              }}
            >
              <img
                src="/images/banner_1.png"
                alt="Banner"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                }}
                onError={(e) => {
                  console.error("Banner failed to load");
                  e.currentTarget.style.display = "none";
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 2,
                }}
              >
                <img
                  src="/images/roi_full.png"
                  alt="ROI"
                  style={{
                    maxWidth: "200px",
                    height: "auto",
                    display: "block",
                  }}
                  onError={(e) => {
                    console.error("Main logo failed to load");
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "0 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  height: "64px",
                  background: "transparent",
                  zIndex: 2,
                }}
              >
                <Button
                  type="text"
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setCollapsed(!collapsed)}
                  style={{ fontSize: "16px", width: 64, height: 64, color: "#FFFFFF" }}
                />
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "logout",
                        icon: <LogoutOutlined />,
                        label: "Logout",
                        onClick: () => logout(),
                      },
                    ],
                  }}
                  placement="bottomRight"
                >
                  <Space style={{ cursor: "pointer" }}>
                    <Avatar style={{ backgroundColor: "#2E7D32" }}>
                      {userInitial}
                    </Avatar>
                    <span style={{ color: "#FFFFFF" }}>{displayName}</span>
                  </Space>
                </Dropdown>
              </div>
            </div>
          </Header>
          <Content
            style={{
              margin: "24px",
              padding: "24px",
              minHeight: 280,
              position: "relative",
            }}
          >
            <Outlet />
          </Content>
        </AntdLayout>
      </AntdLayout>
    </div>
  );
};

export default CustomLayout;