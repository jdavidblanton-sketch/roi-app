import React, { useState, useEffect } from "react";
import { Card, Form, Switch, TimePicker, Button, Space, message, Tabs, Table, Popconfirm, Input, Row, Col, Typography } from "antd";
import { PlusOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_closed: boolean;
  open_time?: string;
  close_time?: string;
}

export const ShopSettings: React.FC = () => {
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [workWeek, setWorkWeek] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });
  const [operationalHours, setOperationalHours] = useState({
    monday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    tuesday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    wednesday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    thursday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    friday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    saturday: { open: dayjs("08:00", "HH:mm"), close: dayjs("16:00", "HH:mm") },
    sunday: { open: null, close: null },
  });
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: "",
    is_closed: true,
    open_time: "",
    close_time: "",
  });
  const [autoRules, setAutoRules] = useState({
    min_techs_per_shift: 1,
    max_techs_per_shift: 3,
    respect_day_off: true,
    respect_hours_limits: true,
  });

  useEffect(() => {
    const shopId = localStorage.getItem("currentShopId");
    if (shopId) {
      setCurrentShopId(shopId);
      loadSettings(shopId);
    }
  }, []);

  const loadSettings = async (shopId: string) => {
    setLoading(true);
    const { data, error } = await supabaseClient
      .from("shop_settings")
      .select("*")
      .eq("shop_id", shopId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid 406 error

    if (error) {
      console.error("Error loading settings:", error);
    } else if (data) {
      setWorkWeek(data.work_week || workWeek);
      if (data.operational_hours) {
        const hours: any = {};
        Object.keys(data.operational_hours).forEach((day) => {
          const h = data.operational_hours[day];
          hours[day] = {
            open: h.open ? dayjs(h.open, "HH:mm") : null,
            close: h.close ? dayjs(h.close, "HH:mm") : null,
          };
        });
        setOperationalHours(hours);
      }
      setHolidays(data.holidays || []);
      setAutoRules(data.auto_schedule_rules || autoRules);
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!currentShopId) return;

    setLoading(true);

    const formattedHours: any = {};
    Object.keys(operationalHours).forEach((day) => {
      formattedHours[day] = {
        open: operationalHours[day as keyof typeof operationalHours]?.open?.format("HH:mm") || null,
        close: operationalHours[day as keyof typeof operationalHours]?.close?.format("HH:mm") || null,
      };
    });

    // Use upsert with onConflict to handle duplicates properly
    const { error } = await supabaseClient
      .from("shop_settings")
      .upsert({
        shop_id: currentShopId,
        work_week: workWeek,
        operational_hours: formattedHours,
        holidays: holidays,
        auto_schedule_rules: autoRules,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'shop_id',
      });

    if (error) {
      console.error("Error saving settings:", error);
      message.error("Failed to save settings: " + error.message);
    } else {
      message.success("Settings saved successfully");
    }
    setLoading(false);
  };

  const addHoliday = () => {
    if (!newHoliday.name || !newHoliday.date) {
      message.error("Please enter holiday name and date");
      return;
    }
    setHolidays([...holidays, { ...newHoliday, id: Date.now().toString() }]);
    setNewHoliday({ name: "", date: "", is_closed: true, open_time: "", close_time: "" });
  };

  const removeHoliday = (id: string) => {
    setHolidays(holidays.filter((h) => h.id !== id));
  };

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div style={{ padding: "24px" }}>
      <Card
        style={{
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <Title level={2} style={{ color: "#E5E7EB", margin: 0 }}>
            Shop Settings
          </Title>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={saveSettings}
            loading={loading}
            style={{ backgroundColor: "#2E7D32" }}
          >
            Save All Settings
          </Button>
        </div>

        <Tabs defaultActiveKey="workweek" style={{ color: "#E5E7EB" }}>
          <TabPane tab="Work Week" key="workweek">
            <Row gutter={[16, 16]}>
              {days.map((day, index) => (
                <Col span={6} key={day}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px",
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: "8px",
                    }}
                  >
                    <span style={{ color: "#E5E7EB" }}>{dayLabels[index]}</span>
                    <Switch
                      checked={workWeek[day as keyof typeof workWeek]}
                      onChange={(checked) => setWorkWeek({ ...workWeek, [day]: checked })}
                      checkedChildren="Open"
                      unCheckedChildren="Closed"
                    />
                  </div>
                </Col>
              ))}
            </Row>
          </TabPane>

          <TabPane tab="Operational Hours" key="hours">
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {days.map((day, index) => (
                <div
                  key={day}
                  style={{
                    marginBottom: "16px",
                    padding: "16px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                  }}
                >
                  <Title level={4} style={{ color: "#E5E7EB", marginBottom: "12px" }}>
                    {dayLabels[index]}
                  </Title>
                  {workWeek[day as keyof typeof workWeek] ? (
                    <Space>
                      <TimePicker
                        value={operationalHours[day as keyof typeof operationalHours]?.open}
                        onChange={(time) =>
                          setOperationalHours({
                            ...operationalHours,
                            [day]: { ...operationalHours[day as keyof typeof operationalHours], open: time },
                          })
                        }
                        format="HH:mm"
                        placeholder="Open time"
                      />
                      <span style={{ color: "#E5E7EB" }}>to</span>
                      <TimePicker
                        value={operationalHours[day as keyof typeof operationalHours]?.close}
                        onChange={(time) =>
                          setOperationalHours({
                            ...operationalHours,
                            [day]: { ...operationalHours[day as keyof typeof operationalHours], close: time },
                          })
                        }
                        format="HH:mm"
                        placeholder="Close time"
                      />
                    </Space>
                  ) : (
                    <Text style={{ color: "#9CA3AF" }}>Shop closed on {dayLabels[index]}</Text>
                  )}
                </div>
              ))}
            </div>
          </TabPane>

          <TabPane tab="Holidays" key="holidays">
            <div style={{ marginBottom: "16px" }}>
              <Row gutter={[16, 16]} align="bottom">
                <Col span={6}>
                  <Input
                    placeholder="Holiday name (e.g., Christmas)"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  />
                </Col>
                <Col span={6}>
                  <Input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  />
                </Col>
                <Col span={4}>
                  <Switch
                    checked={newHoliday.is_closed}
                    onChange={(checked) => setNewHoliday({ ...newHoliday, is_closed: checked })}
                    checkedChildren="Closed"
                    unCheckedChildren="Reduced Hours"
                  />
                </Col>
                {!newHoliday.is_closed && (
                  <>
                    <Col span={3}>
                      <TimePicker
                        onChange={(time) => setNewHoliday({ ...newHoliday, open_time: time?.format("HH:mm") || "" })}
                        format="HH:mm"
                        placeholder="Open"
                      />
                    </Col>
                    <Col span={3}>
                      <TimePicker
                        onChange={(time) => setNewHoliday({ ...newHoliday, close_time: time?.format("HH:mm") || "" })}
                        format="HH:mm"
                        placeholder="Close"
                      />
                    </Col>
                  </>
                )}
                <Col span={2}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={addHoliday} style={{ backgroundColor: "#2E7D32" }}>
                    Add
                  </Button>
                </Col>
              </Row>
            </div>
            <Table
              dataSource={holidays}
              rowKey="id"
              columns={[
                { title: "Name", dataIndex: "name", key: "name" },
                { title: "Date", dataIndex: "date", key: "date" },
                {
                  title: "Status",
                  key: "status",
                  render: (_: any, record: Holiday) =>
                    record.is_closed ? "Closed" : `Reduced Hours: ${record.open_time} - ${record.close_time}`,
                },
                {
                  title: "Actions",
                  key: "actions",
                  render: (_: any, record: Holiday) => (
                    <Popconfirm title="Remove this holiday?" onConfirm={() => removeHoliday(record.id)}>
                      <Button type="link" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ]}
              pagination={false}
            />
          </TabPane>

          <TabPane tab="Auto Schedule Rules" key="rules">
            <div style={{ maxWidth: "400px" }}>
              <div
                style={{
                  marginBottom: "16px",
                  padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                }}
              >
                <Text style={{ color: "#E5E7EB", display: "block", marginBottom: "8px" }}>Minimum technicians per shift</Text>
                <Input
                  type="number"
                  value={autoRules.min_techs_per_shift}
                  onChange={(e) => setAutoRules({ ...autoRules, min_techs_per_shift: parseInt(e.target.value) || 1 })}
                  min={0}
                  max={10}
                  style={{ width: "100px" }}
                />
              </div>
              <div
                style={{
                  marginBottom: "16px",
                  padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                }}
              >
                <Text style={{ color: "#E5E7EB", display: "block", marginBottom: "8px" }}>Maximum technicians per shift</Text>
                <Input
                  type="number"
                  value={autoRules.max_techs_per_shift}
                  onChange={(e) => setAutoRules({ ...autoRules, max_techs_per_shift: parseInt(e.target.value) || 3 })}
                  min={1}
                  max={20}
                  style={{ width: "100px" }}
                />
              </div>
              <div
                style={{
                  marginBottom: "16px",
                  padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#E5E7EB" }}>Respect technician day-off preferences</Text>
                  <Switch
                    checked={autoRules.respect_day_off}
                    onChange={(checked) => setAutoRules({ ...autoRules, respect_day_off: checked })}
                  />
                </div>
              </div>
              <div
                style={{
                  marginBottom: "16px",
                  padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#E5E7EB" }}>Respect technician min/max hour limits</Text>
                  <Switch
                    checked={autoRules.respect_hours_limits}
                    onChange={(checked) => setAutoRules({ ...autoRules, respect_hours_limits: checked })}
                  />
                </div>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};