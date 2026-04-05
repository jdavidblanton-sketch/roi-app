import React, { useState, useEffect } from "react";
import { Table, Card, Statistic, Row, Col, Select, Spin, message } from "antd";
import { CarOutlined, DollarOutlined, ClockCircleOutlined, UserOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";

const { Option } = Select;

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  pay_rate: number;
  pay_type: string;
}

interface DailyEntry {
  date: string;
  car_count: number;
  gross_sales: number;
}

interface TechLog {
  tech_id: string;
  date: string;
  hours_worked: number;
  flag_hours: number;
  jobs_completed: number;
  cars_serviced: number;
  revenue_generated: number;
}

interface TechPerformanceData {
  id: string;
  name: string;
  cars_serviced: number;
  revenue_generated: number;
  flag_hours: number;
  hours_worked: number;
  efficiency: number;
  jobs_completed: number;
}

export const TechPerformance: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [performanceData, setPerformanceData] = useState<TechPerformanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<string>("week");
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);

  useEffect(() => {
    const shopId = localStorage.getItem("currentShopId");
    if (shopId) {
      setCurrentShopId(shopId);
      loadData(shopId);
    }
  }, [period]);

  const loadData = async (shopId: string) => {
    setLoading(true);
    try {
      // Load technicians
      const { data: techData, error: techError } = await supabaseClient
        .from("technicians")
        .select("id, first_name, last_name, pay_rate, pay_type")
        .eq("shop_id", shopId);

      if (techError) throw techError;
      setTechnicians(techData || []);

      if (!techData || techData.length === 0) {
        setPerformanceData([]);
        setLoading(false);
        return;
      }

      // Calculate date range based on period
      const today = new Date();
      let startDate: Date;
      if (period === "week") {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
      } else if (period === "month") {
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
      } else {
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
      }
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = today.toISOString().split("T")[0];

      // Load daily entries for car count and sales
      const { data: dailyData, error: dailyError } = await supabaseClient
        .from("daily_entries")
        .select("date, car_count, gross_sales")
        .eq("shop_id", shopId)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (dailyError) throw dailyError;

      // For now, use mock tech log data since we haven't built the tech log feature yet
      // This will be replaced when tech logs are implemented
      const mockTechLogs: TechLog[] = techData.map((tech) => ({
        tech_id: tech.id,
        date: new Date().toISOString().split("T")[0],
        hours_worked: 40,
        flag_hours: Math.floor(Math.random() * 20) + 25,
        jobs_completed: Math.floor(Math.random() * 15) + 10,
        cars_serviced: Math.floor(Math.random() * 25) + 15,
        revenue_generated: Math.floor(Math.random() * 5000) + 3000,
      }));

      const totalCars = dailyData?.reduce((sum, d) => sum + (d.car_count || 0), 0) || 0;
      const totalSales = dailyData?.reduce((sum, d) => sum + (d.gross_sales || 0), 0) || 0;

      const performance: TechPerformanceData[] = techData.map((tech) => {
        const techLogs = mockTechLogs.filter(log => log.tech_id === tech.id);
        const carsServiced = techLogs.reduce((sum, log) => sum + log.cars_serviced, 0);
        const revenueGenerated = techLogs.reduce((sum, log) => sum + log.revenue_generated, 0);
        const flagHours = techLogs.reduce((sum, log) => sum + log.flag_hours, 0);
        const hoursWorked = techLogs.reduce((sum, log) => sum + log.hours_worked, 0);
        const jobsCompleted = techLogs.reduce((sum, log) => sum + log.jobs_completed, 0);
        const efficiency = hoursWorked > 0 ? flagHours / hoursWorked : 0;

        return {
          id: tech.id,
          name: `${tech.first_name} ${tech.last_name}`,
          cars_serviced: carsServiced,
          revenue_generated: revenueGenerated,
          flag_hours: flagHours,
          hours_worked: hoursWorked,
          efficiency: efficiency,
          jobs_completed: jobsCompleted,
        };
      });

      setPerformanceData(performance);
    } catch (error) {
      console.error("Error loading performance data:", error);
      message.error("Failed to load performance data");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Technician", dataIndex: "name", key: "name", width: 150 },
    { title: "Cars Serviced", dataIndex: "cars_serviced", key: "cars_serviced", render: (val: number) => val || 0 },
    { title: "Jobs Completed", dataIndex: "jobs_completed", key: "jobs_completed", render: (val: number) => val || 0 },
    { title: "Revenue", dataIndex: "revenue_generated", key: "revenue_generated", render: (val: number) => `$${(val || 0).toLocaleString()}` },
    { title: "Flag Hours", dataIndex: "flag_hours", key: "flag_hours", render: (val: number) => val || 0 },
    { title: "Hours Worked", dataIndex: "hours_worked", key: "hours_worked", render: (val: number) => val || 0 },
    { 
      title: "Efficiency", 
      dataIndex: "efficiency", 
      key: "efficiency", 
      render: (val: number) => `${Math.round((val || 0) * 100)}%`,
      sorter: (a: TechPerformanceData, b: TechPerformanceData) => a.efficiency - b.efficiency,
    },
  ];

  // Calculate totals
  const totalCars = performanceData.reduce((sum, t) => sum + t.cars_serviced, 0);
  const totalRevenue = performanceData.reduce((sum, t) => sum + t.revenue_generated, 0);
  const totalFlagHours = performanceData.reduce((sum, t) => sum + t.flag_hours, 0);
  const totalHours = performanceData.reduce((sum, t) => sum + t.hours_worked, 0);
  const avgEfficiency = totalHours > 0 ? (totalFlagHours / totalHours) * 100 : 0;

  return (
    <div style={{ padding: "24px" }}>
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} style={{ display: "flex", justifyContent: "flex-end" }}>
          <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
            <Option value="week">Last 7 Days</Option>
            <Option value="month">Last 30 Days</Option>
            <Option value="year">Last 12 Months</Option>
          </Select>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Statistic title="Total Cars" value={totalCars} prefix={<CarOutlined />} valueStyle={{ color: "#E5E7EB" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Statistic title="Total Revenue" value={totalRevenue} prefix={<DollarOutlined />} precision={0} valueStyle={{ color: "#E5E7EB" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Statistic title="Flag Hours" value={totalFlagHours} prefix={<ClockCircleOutlined />} valueStyle={{ color: "#E5E7EB" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Statistic title="Avg Efficiency" value={avgEfficiency.toFixed(1)} suffix="%" prefix={<UserOutlined />} valueStyle={{ color: "#E5E7EB" }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "16px" }}>
        <Table
          dataSource={performanceData}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};