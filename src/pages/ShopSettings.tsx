import React, { useState, useEffect } from "react";
import { Card, Switch, TimePicker, Button, Space, message, Tabs, Table, Popconfirm, Input, Row, Col, Typography, InputNumber, Divider, Select, Tooltip, Alert } from "antd";
import { SaveOutlined, PlusOutlined, DeleteOutlined, CopyOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";
import dayjs, { Dayjs } from "dayjs";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_closed: boolean;
  open_time?: string;
  close_time?: string;
}

const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface OperationalHoursState {
  monday: { open: Dayjs | null; close: Dayjs | null };
  tuesday: { open: Dayjs | null; close: Dayjs | null };
  wednesday: { open: Dayjs | null; close: Dayjs | null };
  thursday: { open: Dayjs | null; close: Dayjs | null };
  friday: { open: Dayjs | null; close: Dayjs | null };
  saturday: { open: Dayjs | null; close: Dayjs | null };
  sunday: { open: Dayjs | null; close: Dayjs | null };
}

export const ShopSettings: React.FC = () => {
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Work Week
  const [workWeek, setWorkWeek] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });
  
  // Operational Hours
  const [operationalHours, setOperationalHours] = useState<OperationalHoursState>({
    monday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    tuesday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    wednesday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    thursday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    friday: { open: dayjs("07:30", "HH:mm"), close: dayjs("18:00", "HH:mm") },
    saturday: { open: dayjs("08:00", "HH:mm"), close: dayjs("16:00", "HH:mm") },
    sunday: { open: null, close: null },
  });
  
  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: "",
    is_closed: true,
    open_time: "",
    close_time: "",
  });
  
  // Auto Schedule Rules
  const [autoRules, setAutoRules] = useState({
    min_techs_per_shift: 1,
    max_techs_per_shift: 3,
    target_shift_hours: 8.5,
    lunch_minutes: 30,
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
      .maybeSingle();

    if (error) {
      console.error("Error loading settings:", error);
    } else if (data) {
      setWorkWeek(data.work_week || workWeek);
      
      if (data.operational_hours) {
        const hours: OperationalHoursState = { ...operationalHours };
        Object.keys(data.operational_hours).forEach((day) => {
          const h = data.operational_hours[day as keyof typeof data.operational_hours];
          hours[day as keyof OperationalHoursState] = {
            open: h?.open ? dayjs(h.open, "HH:mm") : null,
            close: h?.close ? dayjs(h.close, "HH:mm") : null,
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
      const hours = operationalHours[day as keyof OperationalHoursState];
      formattedHours[day] = {
        open: hours?.open?.format("HH:mm") || null,
        close: hours?.close?.format("HH:mm") || null,
      };
    });

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

  const handleCopyHoursToAll = (sourceDay: string) => {
    const sourceHours = operationalHours[sourceDay as keyof OperationalHoursState];
    if (!sourceHours?.open || !sourceHours?.close) {
      message.error("Source day has no hours set");
      return;
    }
    
    const newHours = { ...operationalHours };
    daysOfWeek.forEach(day => {
      if (workWeek[day as keyof typeof workWeek]) {
        newHours[day as keyof OperationalHoursState] = {
          open: sourceHours.open,
          close: sourceHours.close,
        };
      }
    });
    setOperationalHours(newHours);
    message.success("Hours copied to all open days");
  };

  const getOpenDaysCount = (): number => {
    return Object.values(workWeek).filter(v => v === true).length;
  };

  const openDaysCount = getOpenDaysCount();
  const isDayOffRespected = openDaysCount > 5;

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

        <Alert
          message="Scheduling Priority"
          description="Settings are applied in priority order: Shop Hours → Coverage Requirements → Tech Preferences."
          type="info"
          showIcon
          style={{ marginBottom: "16px", background: "rgba(46,125,50,0.2)", borderColor: "#2E7D32" }}
        />

        <Tabs defaultActiveKey="workweek" style={{ color: "#E5E7EB" }}>
          {/* Work Week Tab */}
          <TabPane tab="Work Week" key="workweek">
            <Row gutter={[16, 16]}>
              {daysOfWeek.map((day, index) => (
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
            <Divider style={{ borderColor: "rgba(255,255,255,0.1)", margin: "16px 0" }} />
            <Alert
              message={`Shop is open ${openDaysCount} days per week. ${isDayOffRespected ? "Tech day off preferences WILL be respected." : "Tech day off preferences will be IGNORED (shop open 5 days or less)."}`}
              type={isDayOffRespected ? "success" : "warning"}
              showIcon
              style={{ background: "rgba(46,125,50,0.15)", borderColor: isDayOffRespected ? "#2E7D32" : "#E65100" }}
            />
          </TabPane>

          {/* Operational Hours Tab */}
          <TabPane tab="Operational Hours" key="hours">
            <Alert
              message="Daily Hours"
              description="Set open and close times for each day. Use 'Copy to All Open Days' to apply the same hours to all days."
              type="info"
              showIcon
              style={{ marginBottom: "16px", background: "rgba(46,125,50,0.2)", borderColor: "#2E7D32" }}
            />
            
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {daysOfWeek.map((day, index) => (
                <div
                  key={day}
                  style={{
                    marginBottom: "16px",
                    padding: "16px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <Title level={4} style={{ color: "#E5E7EB", marginBottom: 0 }}>
                      {dayLabels[index]}
                    </Title>
                    {workWeek[day as keyof typeof workWeek] && (
                      <Button 
                        size="small" 
                        icon={<CopyOutlined />}
                        onClick={() => handleCopyHoursToAll(day)}
                      >
                        Copy to All Open Days
                      </Button>
                    )}
                  </div>
                  {workWeek[day as keyof typeof workWeek] ? (
                    <Space>
                      <TimePicker
                        value={operationalHours[day as keyof OperationalHoursState]?.open}
                        onChange={(time) =>
                          setOperationalHours({
                            ...operationalHours,
                            [day]: { ...operationalHours[day as keyof OperationalHoursState], open: time },
                          })
                        }
                        format="HH:mm"
                        placeholder="Open time"
                      />
                      <span style={{ color: "#E5E7EB" }}>to</span>
                      <TimePicker
                        value={operationalHours[day as keyof OperationalHoursState]?.close}
                        onChange={(time) =>
                          setOperationalHours({
                            ...operationalHours,
                            [day]: { ...operationalHours[day as keyof OperationalHoursState], close: time },
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

          {/* Holidays Tab */}
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

          {/* Auto Schedule Rules Tab */}
          <TabPane tab="Auto Schedule Rules" key="rules">
            <div style={{ maxWidth: "500px" }}>
              <div
                style={{
                  marginBottom: "16px",
                  padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Text style={{ color: "#E5E7EB" }}>Minimum Technicians Per Day</Text>
                  <Tooltip title="The absolute minimum number of technicians that MUST work each day">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <InputNumber
                  value={autoRules.min_techs_per_shift}
                  onChange={(val) => setAutoRules({ ...autoRules, min_techs_per_shift: val || 1 })}
                  min={0}
                  max={10}
                  style={{ width: "120px" }}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Text style={{ color: "#E5E7EB" }}>Maximum Technicians Per Day</Text>
                  <Tooltip title="The maximum number of technicians that can work each day">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <InputNumber
                  value={autoRules.max_techs_per_shift}
                  onChange={(val) => setAutoRules({ ...autoRules, max_techs_per_shift: val || 3 })}
                  min={1}
                  max={20}
                  style={{ width: "120px" }}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Text style={{ color: "#E5E7EB" }}>Target Shift Length (hours)</Text>
                  <Tooltip title="Desired shift length before lunch deduction (e.g., 8.5 = 8.5 hour shift)">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <InputNumber
                  value={autoRules.target_shift_hours}
                  onChange={(val) => setAutoRules({ ...autoRules, target_shift_hours: val || 8.5 })}
                  min={4}
                  max={12}
                  step={0.5}
                  style={{ width: "120px" }}
                  addonAfter="hours"
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Text style={{ color: "#E5E7EB" }}>Lunch Break (minutes)</Text>
                  <Tooltip title="Unpaid lunch break deducted from each shift">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <InputNumber
                  value={autoRules.lunch_minutes}
                  onChange={(val) => setAutoRules({ ...autoRules, lunch_minutes: val || 30 })}
                  min={0}
                  max={120}
                  step={15}
                  style={{ width: "120px" }}
                  addonAfter="minutes"
                />
                <Text style={{ color: "#9CA3AF", fontSize: "12px", marginLeft: "8px" }}>
                  (30 min default)
                </Text>
              </div>

              <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />

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
                  <Tooltip title={!isDayOffRespected ? "Shop is open 5 days or less - day off preferences will be ignored" : "When enabled, system tries not to schedule techs on their preferred days off"}>
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <Switch
                  checked={autoRules.respect_day_off && isDayOffRespected}
                  onChange={(checked) => setAutoRules({ ...autoRules, respect_day_off: checked })}
                  disabled={!isDayOffRespected}
                />
                {!isDayOffRespected && (
                  <Text style={{ color: "#E65100", fontSize: "12px", display: "block", marginTop: "8px" }}>
                    Day off preferences ignored because shop is open 5 days or less.
                  </Text>
                )}
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
                  <Tooltip title="Min hours are adhered to first. Max hours are only used if necessary for coverage.">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <Switch
                  checked={autoRules.respect_hours_limits}
                  onChange={(checked) => setAutoRules({ ...autoRules, respect_hours_limits: checked })}
                />
              </div>

              <Divider style={{ borderColor: "rgba(255,255,255,0.1)" }} />

              <div
                style={{
                  padding: "16px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "8px",
                }}
              >
                <Text style={{ color: "#4CAF50", fontSize: "14px", fontWeight: "bold" }}>
                  Example: {autoRules.target_shift_hours} hour shift - {autoRules.lunch_minutes} min lunch = {(autoRules.target_shift_hours - (autoRules.lunch_minutes / 60)).toFixed(1)} paid hours
                </Text>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};