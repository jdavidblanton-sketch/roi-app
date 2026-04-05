import React, { useState } from "react";
import { Card, Form, Input, Button, DatePicker, Row, Col, Statistic, notification } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface DailyData {
  date: string;
  carCount: number;
  grossSales: number;
  grossProfitPercent: number;
  aro: number;
}

export const DailyEntry: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentData, setCurrentData] = useState<DailyData | null>(null);

  const handleSubmit = (values: any) => {
    setLoading(true);
    
    setTimeout(() => {
      const newData: DailyData = {
        date: values.date.format("YYYY-MM-DD"),
        carCount: values.carCount,
        grossSales: values.grossSales,
        grossProfitPercent: values.grossProfitPercent,
        aro: values.grossSales / values.carCount,
      };
      
      setCurrentData(newData);
      console.log("Daily entry saved:", newData);
      alert(`Daily entry saved for ${newData.date}\nCar Count: ${newData.carCount}\nGross Sales: $${newData.grossSales}\nGP%: ${newData.grossProfitPercent}%\nARO: $${newData.aro.toFixed(2)}`);
      
      form.resetFields();
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{ padding: "24px" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            style={{
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "16px",
            }}
          >
            <h2 style={{ color: "#E5E7EB", marginBottom: "24px" }}>Daily KPI Entry</h2>
            
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                date: dayjs(),
              }}
            >
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: "Please select date" }]}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              
              <Form.Item
                name="carCount"
                label="Car Count"
                rules={[{ required: true, message: "Please enter car count" }]}
              >
                <Input type="number" placeholder="Number of cars" />
              </Form.Item>
              
              <Form.Item
                name="grossSales"
                label="Gross Sales ($)"
                rules={[{ required: true, message: "Please enter gross sales" }]}
              >
                <Input type="number" step="0.01" placeholder="Total sales" prefix="$" />
              </Form.Item>
              
              <Form.Item
                name="grossProfitPercent"
                label="Gross Profit %"
                rules={[{ required: true, message: "Please enter gross profit percentage" }]}
              >
                <Input type="number" step="0.1" placeholder="GP%" suffix="%" />
              </Form.Item>
              
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  style={{ backgroundColor: "#2E7D32" }}
                  loading={loading}
                  size="large"
                  block
                >
                  Save Entry
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card
            style={{
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "16px",
            }}
          >
            <h2 style={{ color: "#E5E7EB", marginBottom: "24px" }}>Today's Summary</h2>
            
            {currentData ? (
              <div>
                <Statistic
                  title="Date"
                  value={currentData.date}
                  valueStyle={{ color: "#E5E7EB" }}
                />
                <Statistic
                  title="Car Count"
                  value={currentData.carCount}
                  valueStyle={{ color: "#4CAF50" }}
                  style={{ marginTop: 16 }}
                />
                <Statistic
                  title="Gross Sales"
                  value={`$${currentData.grossSales.toLocaleString()}`}
                  valueStyle={{ color: "#4CAF50" }}
                  style={{ marginTop: 16 }}
                />
                <Statistic
                  title="Gross Profit %"
                  value={`${currentData.grossProfitPercent}%`}
                  valueStyle={{ color: "#4CAF50" }}
                  style={{ marginTop: 16 }}
                />
                <Statistic
                  title="Average Repair Order (ARO)"
                  value={`$${currentData.aro.toFixed(2)}`}
                  valueStyle={{ color: "#1890FF" }}
                  style={{ marginTop: 16 }}
                />
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#9CA3AF", padding: "40px 0" }}>
                No data yet. Submit a daily entry to see summary.
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};