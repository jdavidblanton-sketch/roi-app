import { Card, Row, Col, Typography } from "antd";
import { useGetIdentity } from "@refinedev/core";
import { useNavigate } from "react-router-dom";
import { CustomButton } from "../components/CustomButton";

const { Title, Text } = Typography;

interface User {
  name?: string;
  email?: string;
}

export const Dashboard = () => {
  const { data: user } = useGetIdentity<User>();
  const navigate = useNavigate();

  const cardStyle = {
    background: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
  };

  const headerStyle = {
    color: "#E5E7EB",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    fontSize: "18px",
    fontWeight: 600,
  };

  const displayName = user?.name || user?.email || "Shop Owner";

  return (
    <div style={{ padding: "24px" }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card style={cardStyle} styles={{ body: { padding: "24px" } }}>
            <div style={{ textAlign: "center" }}>
              <Title level={3} style={{ color: "#FFFFFF", marginBottom: "8px" }}>
                Real-Time Operational Intelligence
              </Title>
              <Text style={{ color: "#CCCCCC", fontSize: "16px" }}>
                Welcome back, {displayName}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: "24px" }}>
        <Col xs={24} sm={12} md={8}>
          <Card
            title="Today's KPIs"
            style={cardStyle}
            styles={{
              header: headerStyle,
              body: { padding: "20px" }
            }}
          >
            <Title level={2} style={{ color: "#4CAF50", marginBottom: "8px", fontSize: "32px" }}>0</Title>
            <Text style={{ color: "#CCCCCC", fontSize: "14px" }}>Car Count</Text>
            <Title level={2} style={{ color: "#4CAF50", marginTop: "16px", marginBottom: "8px", fontSize: "32px" }}>$0</Title>
            <Text style={{ color: "#CCCCCC", fontSize: "14px" }}>Gross Sales</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card
            title="Tech Performance"
            style={cardStyle}
            styles={{
              header: headerStyle,
              body: { padding: "20px" }
            }}
          >
            <Text style={{ color: "#CCCCCC" }}>No techs added yet</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card
            title="Quick Actions"
            style={cardStyle}
            styles={{
              header: headerStyle,
              body: { padding: "20px" }
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div onClick={() => navigate("/techs")}>
                <CustomButton type="copper" size="long" text="Add Technician" />
              </div>
              <div onClick={() => navigate("/schedule")}>
                <CustomButton type="copper" size="long" text="Create Schedule" />
              </div>
              <div onClick={() => navigate("/daily-entry")}>
                <CustomButton type="copper" size="long" text="Log Daily KPIs" />
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};