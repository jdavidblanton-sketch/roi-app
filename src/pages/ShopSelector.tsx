import React, { useState, useEffect } from "react";
import { Card, Select, Button, Input, Space, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../utils";

const { Title, Text } = Typography;
const { Option } = Select;

const MAX_SHOPS = 3;
const MAX_TECHS_PER_SHOP = 10;

interface Shop {
  id: string;
  name: string;
  techCount: number;
}

export const ShopSelector: React.FC = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [newShopName, setNewShopName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    const { data, error } = await supabaseClient
      .from("shops")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading shops:", error);
      return;
    }

    if (data) {
      const shopsWithCounts = await Promise.all(
        data.map(async (shop) => {
          const { count } = await supabaseClient
            .from("technicians")
            .select("*", { count: "exact", head: true })
            .eq("shop_id", shop.id);
          return { ...shop, techCount: count || 0 };
        })
      );
      setShops(shopsWithCounts);
    }
  };

  const createShop = async () => {
    if (!newShopName.trim()) {
      message.error("Please enter a shop name");
      return;
    }
    if (shops.length >= MAX_SHOPS) {
      message.error(`Maximum ${MAX_SHOPS} shops allowed`);
      return;
    }
    
    setLoading(true);
    const { error } = await supabaseClient.from("shops").insert({
      name: newShopName,
    });

    if (error) {
      message.error("Failed to create shop");
      console.error(error);
    } else {
      message.success(`Shop "${newShopName}" created`);
      setNewShopName("");
      loadShops();
    }
    setLoading(false);
  };

  const selectShop = (shopId: string) => {
    const shop = shops.find((s) => s.id === shopId);
    if (shop) {
      localStorage.setItem("currentShopId", shopId);
      localStorage.setItem("currentShopName", shop.name);
      setSelectedShop(shopId);
      window.dispatchEvent(new Event("shopChanged"));
      message.success(`Switched to ${shop.name}`);
      navigate("/dashboard");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "24px",
        backgroundImage: "url('/images/roi_bg_v1.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Card
        style={{
          maxWidth: 500,
          width: "100%",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "16px",
        }}
      >
        <Title level={2} style={{ color: "#E5E7EB", textAlign: "center", marginBottom: 8 }}>
          ROI
        </Title>
        <Text style={{ color: "#9CA3AF", display: "block", textAlign: "center", marginBottom: 24 }}>
          Real-Time Operational Intelligence
        </Text>

        <Title level={4} style={{ color: "#E5E7EB" }}>
          Your Shops ({shops.length}/{MAX_SHOPS})
        </Title>
        {shops.length === 0 ? (
          <Text style={{ color: "#9CA3AF" }}>No shops yet. Create one below.</Text>
        ) : (
          <Select
            placeholder="Select a shop"
            style={{ width: "100%", marginBottom: 16 }}
            onChange={selectShop}
            value={selectedShop}
          >
            {shops.map((shop) => (
              <Option key={shop.id} value={shop.id}>
                {shop.name} ({shop.techCount}/{MAX_TECHS_PER_SHOP} techs)
              </Option>
            ))}
          </Select>
        )}

        <Title level={4} style={{ color: "#E5E7EB", marginTop: 24 }}>
          Create New Shop
        </Title>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            placeholder="Shop name"
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
            onPressEnter={createShop}
          />
          <Button type="primary" onClick={createShop} style={{ backgroundColor: "#2E7D32" }} loading={loading}>
            Create
          </Button>
        </Space.Compact>

        <Text style={{ color: "#6B7280", fontSize: 12, display: "block", textAlign: "center", marginTop: 24 }}>
          Max {MAX_SHOPS} shops • {MAX_TECHS_PER_SHOP} techs per shop
        </Text>
      </Card>
    </div>
  );
};