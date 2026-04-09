import React, { useState, useEffect } from "react";
import { Card, Switch, TimePicker, Button, Space, message, Tabs, Table, Popconfirm, Input, Row, Col, Typography, InputNumber, Collapse, Alert, Divider, Select, Tooltip, Modal, Form, Tag } from "antd";
import { PlusOutlined, DeleteOutlined, SaveOutlined, CopyOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";
import dayjs, { Dayjs } from "dayjs";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Option } = Select;

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_closed: boolean;
  open_time?: string;
  close_time?: string;
}

interface DayOverride {
  day: string;
  min_techs: number | null;
  max_techs: number | null;
}

interface ShiftTemplate {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_default: boolean;
}

interface DailyShiftSetting {
  day: string;
  template_id: string | null;
  custom_name: string | null;
  custom_start: string | null;
  custom_end: string | null;
}

interface OperationalHoursState {
  monday: { open: Dayjs | null; close: Dayjs | null };
  tuesday: { open: Dayjs | null; close: Dayjs | null };
  wednesday: { open: Dayjs | null; close: Dayjs | null };
  thursday: { open: Dayjs | null; close: Dayjs | null };
  friday: { open: Dayjs | null; close: Dayjs | null };
  saturday: { open: Dayjs | null; close: Dayjs | null };
  sunday: { open: Dayjs | null; close: Dayjs | null };
}

const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const defaultShiftTemplates: ShiftTemplate[] = [
  { id: "1", name: "Morning", start_time: "07:30", end_time: "16:00", is_default: true },
  { id: "2", name: "Mid", start_time: "08:30", end_time: "17:00", is_default: false },
  { id: "3", name: "Late", start_time: "09:30", end_time: "18:00", is_default: false },
];

const getInitialDayOverrides = (): DayOverride[] => {
  return daysOfWeek.map(day => ({ day, min_techs: null, max_techs: null }));
};

const getInitialDailyShiftSettings = (): DailyShiftSetting[] => {
  return daysOfWeek.map(day => ({ day, template_id: "1", custom_name: null, custom_start: null, custom_end: null }));
};

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
  
  const [operationalHours, setOperationalHours] = useState<OperationalHoursState>({
    monday: { open: dayjs("07:30", "HH:mm"), close: dayjs("16:00", "HH:mm") },
    tuesday: { open: dayjs("07:30", "HH:mm"), close: dayjs("16:00", "HH:mm") },
    wednesday: { open: dayjs("07:30", "HH:mm"), close: dayjs("16:00", "HH:mm") },
    thursday: { open: dayjs("07:30", "HH:mm"), close: dayjs("16:00", "HH:mm") },
    friday: { open: dayjs("07:30", "HH:mm"), close: dayjs("16:00", "HH:mm") },
    saturday: { open: dayjs("08:00", "HH:mm"), close: dayjs("16:00", "HH:mm") },
    sunday: { open: null, close: null },
  });
  
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>(defaultShiftTemplates);
  const [dailyShiftSettings, setDailyShiftSettings] = useState<DailyShiftSetting[]>(getInitialDailyShiftSettings());
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [templateForm] = Form.useForm();
  
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
    manual_override_enabled: false,
    manual_override_weeks: 0,
    default_shift_hours: 8.5,
    default_lunch_minutes: 30,
  });
  
  const [enableAdvancedOverrides, setEnableAdvancedOverrides] = useState(false);
  const [dayOverrides, setDayOverrides] = useState<DayOverride[]>(getInitialDayOverrides());
  
  const [shiftTypeLimits, setShiftTypeLimits] = useState({
    morning: { min: 1, max: 3, enabled: false },
    mid: { min: 1, max: 3, enabled: false },
    late: { min: 1, max: 3, enabled: false },
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
      
      if (data.shift_templates) {
        setShiftTemplates(data.shift_templates);
      }
      
      if (data.daily_shift_settings) {
        setDailyShiftSettings(data.daily_shift_settings);
      }
      
      setHolidays(data.holidays || []);
      setAutoRules({
        ...autoRules,
        ...data.auto_schedule_rules,
        default_shift_hours: data.auto_schedule_rules?.default_shift_hours || 8.5,
        default_lunch_minutes: data.auto_schedule_rules?.default_lunch_minutes || 30,
      });
      
      if (data.advanced_settings) {
        setEnableAdvancedOverrides(data.advanced_settings.enable || false);
        if (data.advanced_settings.day_overrides && data.advanced_settings.day_overrides.length > 0) {
          setDayOverrides(data.advanced_settings.day_overrides);
        } else {
          setDayOverrides(getInitialDayOverrides());
        }
        if (data.advanced_settings.shift_type_limits) {
          setShiftTypeLimits(data.advanced_settings.shift_type_limits);
        }
      } else {
        setDayOverrides(getInitialDayOverrides());
      }
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

    const advanced_settings = {
      enable: enableAdvancedOverrides,
      day_overrides: dayOverrides,
      shift_type_limits: shiftTypeLimits,
    };

    const { error } = await supabaseClient
      .from("shop_settings")
      .upsert({
        shop_id: currentShopId,
        work_week: workWeek,
        operational_hours: formattedHours,
        shift_templates: shiftTemplates,
        daily_shift_settings: dailyShiftSettings,
        holidays: holidays,
        auto_schedule_rules: autoRules,
        advanced_settings: advanced_settings,
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

  const updateDayOverride = (day: string, field: 'min_techs' | 'max_techs', value: number | null) => {
    setDayOverrides(prev => prev.map(d => 
      d.day === day ? { ...d, [field]: value } : d
    ));
  };

  const updateShiftTypeLimit = (shift: 'morning' | 'mid' | 'late', field: 'min' | 'max' | 'enabled', value: number | boolean) => {
    setShiftTypeLimits(prev => ({
      ...prev,
      [shift]: { ...prev[shift], [field]: value }
    }));
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    templateForm.resetFields();
    setTemplateModalVisible(true);
  };

  const handleEditTemplate = (template: ShiftTemplate) => {
    setEditingTemplate(template);
    templateForm.setFieldsValue({
      name: template.name,
      start_time: dayjs(template.start_time, "HH:mm"),
      end_time: dayjs(template.end_time, "HH:mm"),
    });
    setTemplateModalVisible(true);
  };

  const handleDeleteTemplate = (id: string) => {
    setShiftTemplates(shiftTemplates.filter(t => t.id !== id));
    message.success("Shift template deleted");
  };

  const handleSaveTemplate = (values: any) => {
    const startTime = values.start_time.format("HH:mm");
    const endTime = values.end_time.format("HH:mm");
    
    if (editingTemplate) {
      setShiftTemplates(shiftTemplates.map(t => 
        t.id === editingTemplate.id ? { ...t, name: values.name, start_time: startTime, end_time: endTime } : t
      ));
      message.success("Shift template updated");
    } else {
      const newTemplate: ShiftTemplate = {
        id: Date.now().toString(),
        name: values.name,
        start_time: startTime,
        end_time: endTime,
        is_default: false,
      };
      setShiftTemplates([...shiftTemplates, newTemplate]);
      message.success("Shift template added");
    }
    setTemplateModalVisible(false);
    templateForm.resetFields();
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

  const handleApplyShiftTemplateToDay = (day: string, templateId: string) => {
    const template = shiftTemplates.find(t => t.id === templateId);
    if (template) {
      // Create display text: either custom name or time range
      let customName = null;
      if (template.name && !["Morning", "Mid", "Late"].includes(template.name)) {
        customName = template.name;
      }
      
      setDailyShiftSettings(prev => prev.map(d => 
        d.day === day ? { 
          ...d, 
          template_id: templateId, 
          custom_name: customName,
          custom_start: null, 
          custom_end: null 
        } : d
      ));
      
      const newHours = { ...operationalHours };
      newHours[day as keyof OperationalHoursState] = {
        open: dayjs(template.start_time, "HH:mm"),
        close: dayjs(template.end_time, "HH:mm"),
      };
      setOperationalHours(newHours);
      
      const displayName = customName || `${template.start_time}-${template.end_time}`;
      message.success(`Applied "${displayName}" shift to ${dayLabels[daysOfWeek.indexOf(day)]}`);
    }
  };

  const handleCopyShiftToAll = (templateId: string) => {
    const template = shiftTemplates.find(t => t.id === templateId);
    if (template) {
      let customName = null;
      if (template.name && !["Morning", "Mid", "Late"].includes(template.name)) {
        customName = template.name;
      }
      
      const newSettings = dailyShiftSettings.map(d => ({
        ...d,
        template_id: templateId,
        custom_name: customName,
        custom_start: null,
        custom_end: null,
      }));
      setDailyShiftSettings(newSettings);
      
      const newHours = { ...operationalHours };
      daysOfWeek.forEach(day => {
        if (workWeek[day as keyof typeof workWeek]) {
          newHours[day as keyof OperationalHoursState] = {
            open: dayjs(template.start_time, "HH:mm"),
            close: dayjs(template.end_time, "HH:mm"),
          };
        }
      });
      setOperationalHours(newHours);
      
      const displayName = customName || `${template.start_time}-${template.end_time}`;
      message.success(`Applied "${displayName}" shift to all days`);
    }
  };

  const getOpenDaysCount = (): number => {
    return Object.values(workWeek).filter(v => v === true).length;
  };

  const openDaysCount = getOpenDaysCount();
  const isDayOffRespected = openDaysCount > 5;

  const dayOverrideColumns = [
    { 
      title: "Day", 
      dataIndex: "day", 
      key: "day", 
      render: (day: string) => dayLabels[daysOfWeek.indexOf(day)] 
    },
    {
      title: "Min Technicians",
      key: "min_techs",
      render: (_: any, record: DayOverride) => (
        <InputNumber
          value={record.min_techs}
          onChange={(val) => updateDayOverride(record.day, 'min_techs', val)}
          min={0}
          max={10}
          placeholder="Use default"
          style={{ width: "120px" }}
        />
      ),
    },
    {
      title: "Max Technicians",
      key: "max_techs",
      render: (_: any, record: DayOverride) => (
        <InputNumber
          value={record.max_techs}
          onChange={(val) => updateDayOverride(record.day, 'max_techs', val)}
          min={1}
          max={20}
          placeholder="Use default"
          style={{ width: "120px" }}
        />
      ),
    },
  ];

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
          message="Priority-Based Scheduling"
          description="Settings are applied in priority order: Shop Hours → Coverage Requirements → Tech Preferences. Day off preferences are only respected if shop is open more than 5 days per week."
          type="info"
          showIcon
          style={{ marginBottom: "16px", background: "rgba(46,125,50,0.2)", borderColor: "#2E7D32" }}
        />

        <Tabs defaultActiveKey="workweek" style={{ color: "#E5E7EB" }}>
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

          <TabPane tab="Shift Templates" key="shift_templates">
            <Alert
              message="Shift Templates"
              description="Define named shifts. The display name will show in the schedule. If no custom name is set, the time range will be shown."
              type="info"
              showIcon
              style={{ marginBottom: "16px", background: "rgba(46,125,50,0.2)", borderColor: "#2E7D32" }}
            />
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <Text style={{ color: "#E5E7EB", fontSize: "16px" }}>Shift Templates</Text>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTemplate} style={{ backgroundColor: "#2E7D32" }} size="small">
                  Add Template
                </Button>
              </div>
              <Table
                dataSource={shiftTemplates}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: "Name", dataIndex: "name", key: "name" },
                  { title: "Start Time", dataIndex: "start_time", key: "start_time" },
                  { title: "End Time", dataIndex: "end_time", key: "end_time" },
                  { title: "Display", key: "display", render: (_, record) => {
                      if (record.name && !["Morning", "Mid", "Late"].includes(record.name)) {
                        return <Tag color="blue">{record.name}</Tag>;
                      }
                      return <Tag>{`${record.start_time}-${record.end_time}`}</Tag>;
                    }
                  },
                  { title: "Default", dataIndex: "is_default", key: "is_default", render: (val: boolean) => val ? <Tag color="green">Default</Tag> : null },
                  {
                    title: "Actions",
                    key: "actions",
                    render: (_: any, record: ShiftTemplate) => (
                      <Space>
                        <Button type="link" size="small" onClick={() => handleEditTemplate(record)}>Edit</Button>
                        <Popconfirm title="Delete this template?" onConfirm={() => handleDeleteTemplate(record.id)}>
                          <Button type="link" danger size="small">Delete</Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </div>

            <Divider style={{ borderColor: "rgba(255,255,255,0.1)", margin: "16px 0" }} />

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <Text style={{ color: "#E5E7EB", fontSize: "16px" }}>Daily Shift Assignments</Text>
                <Button 
                  icon={<CopyOutlined />} 
                  onClick={() => {
                    const defaultTemplate = shiftTemplates.find(t => t.is_default) || shiftTemplates[0];
                    if (defaultTemplate) handleCopyShiftToAll(defaultTemplate.id);
                  }}
                  size="small"
                >
                  Copy Default to All Days
                </Button>
              </div>
              <Table
                dataSource={dailyShiftSettings}
                rowKey="day"
                pagination={false}
                size="small"
                columns={[
                  { title: "Day", dataIndex: "day", key: "day", render: (day: string) => dayLabels[daysOfWeek.indexOf(day)] },
                  {
                    title: "Assigned Shift",
                    key: "template_id",
                    render: (_: any, record: DailyShiftSetting) => {
                      const template = shiftTemplates.find(t => t.id === record.template_id);
                      if (!template) return <Text type="secondary">No shift assigned</Text>;
                      
                      let displayText = `${template.start_time}-${template.end_time}`;
                      if (template.name && !["Morning", "Mid", "Late"].includes(template.name)) {
                        displayText = template.name;
                      }
                      
                      return (
                        <Select
                          value={record.template_id}
                          onChange={(val) => handleApplyShiftTemplateToDay(record.day, val)}
                          style={{ width: "250px" }}
                          size="small"
                        >
                          {shiftTemplates.map(template => {
                            let optionText = `${template.start_time}-${template.end_time}`;
                            if (template.name && !["Morning", "Mid", "Late"].includes(template.name)) {
                              optionText = template.name;
                            }
                            return (
                              <Option key={template.id} value={template.id}>{optionText}</Option>
                            );
                          })}
                        </Select>
                      );
                    },
                  },
                ]}
              />
            </div>
          </TabPane>

          <TabPane tab="Operational Hours" key="hours">
            <Alert
              message="Daily Hours"
              description="Set custom hours for each day. Use 'Copy to All Open Days' to apply the same hours to all days the shop is open."
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
                  <Text style={{ color: "#E5E7EB" }}>Default Shift Hours</Text>
                  <Tooltip title="Total shift hours before lunch deduction">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <InputNumber
                  value={autoRules.default_shift_hours}
                  onChange={(val) => setAutoRules({ ...autoRules, default_shift_hours: val || 8.5 })}
                  min={1}
                  max={12}
                  step={0.5}
                  style={{ width: "100px" }}
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
                  <Text style={{ color: "#E5E7EB" }}>Default Lunch Break (minutes)</Text>
                  <Tooltip title="Unpaid lunch break deducted from shift">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <InputNumber
                  value={autoRules.default_lunch_minutes}
                  onChange={(val) => setAutoRules({ ...autoRules, default_lunch_minutes: val || 30 })}
                  min={0}
                  max={120}
                  step={15}
                  style={{ width: "100px" }}
                  addonAfter="minutes"
                />
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Text style={{ color: "#E5E7EB" }}>Default Minimum technicians per shift</Text>
                  <Tooltip title="The absolute minimum number of technicians that MUST work each day. Cannot be violated.">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <InputNumber
                  value={autoRules.min_techs_per_shift}
                  onChange={(val) => setAutoRules({ ...autoRules, min_techs_per_shift: val || 1 })}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Text style={{ color: "#E5E7EB" }}>Default Maximum technicians per shift</Text>
                  <Tooltip title="The maximum number of technicians that can work each day. Cannot be exceeded.">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <InputNumber
                  value={autoRules.max_techs_per_shift}
                  onChange={(val) => setAutoRules({ ...autoRules, max_techs_per_shift: val || 3 })}
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
                  marginBottom: "16px",
                  padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: "#E5E7EB" }}>Manual Override Mode</Text>
                  <Tooltip title="When enabled, operator can force schedules (e.g., 4x10 hour days) that bypass normal rules">
                    <QuestionCircleOutlined style={{ color: "#9CA3AF" }} />
                  </Tooltip>
                </div>
                <Switch
                  checked={autoRules.manual_override_enabled}
                  onChange={(checked) => setAutoRules({ ...autoRules, manual_override_enabled: checked })}
                />
              </div>
              {autoRules.manual_override_enabled && (
                <div
                  style={{
                    padding: "16px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "8px",
                  }}
                >
                  <Text style={{ color: "#E5E7EB", display: "block", marginBottom: "8px" }}>Override Duration (weeks)</Text>
                  <InputNumber
                    value={autoRules.manual_override_weeks}
                    onChange={(val) => setAutoRules({ ...autoRules, manual_override_weeks: val || 0 })}
                    min={0}
                    max={52}
                    style={{ width: "100px" }}
                  />
                  <Text style={{ color: "#9CA3AF", fontSize: "12px", display: "block", marginTop: "8px" }}>
                    0 = indefinite, otherwise applies for specified number of weeks
                  </Text>
                </div>
              )}
            </div>
          </TabPane>

          <TabPane tab="Advanced Overrides" key="advanced">
            <Alert
              message="Advanced Overrides"
              description="These settings override the default min/max technician values for specific days or shift types."
              type="info"
              showIcon
              style={{ marginBottom: "16px", background: "rgba(46,125,50,0.2)", borderColor: "#2E7D32" }}
            />
            
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <Text style={{ color: "#E5E7EB", fontSize: "16px" }}>Enable Advanced Overrides</Text>
                <Switch
                  checked={enableAdvancedOverrides}
                  onChange={setEnableAdvancedOverrides}
                  checkedChildren="ON"
                  unCheckedChildren="OFF"
                />
              </div>
              
              {enableAdvancedOverrides && (
                <>
                  <Collapse style={{ marginBottom: "16px", background: "rgba(255,255,255,0.05)" }}>
                    <Panel header={<span style={{ color: "#E5E7EB" }}>Day-Specific Overrides</span>} key="day">
                      <Table
                        dataSource={dayOverrides}
                        rowKey="day"
                        pagination={false}
                        columns={dayOverrideColumns}
                      />
                    </Panel>
                  </Collapse>
                  
                  <Collapse style={{ background: "rgba(255,255,255,0.05)" }}>
                    <Panel header={<span style={{ color: "#E5E7EB" }}>Shift-Type Overrides</span>} key="shift">
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {(['morning', 'mid', 'late'] as const).map((shift) => (
                          <div
                            key={shift}
                            style={{
                              padding: "12px",
                              background: "rgba(255,255,255,0.03)",
                              borderRadius: "8px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                              <Text style={{ color: "#E5E7EB", fontWeight: "bold", textTransform: "capitalize" }}>{shift} Shift</Text>
                              <Switch
                                checked={shiftTypeLimits[shift].enabled}
                                onChange={(checked) => updateShiftTypeLimit(shift, 'enabled', checked)}
                                size="small"
                              />
                            </div>
                            {shiftTypeLimits[shift].enabled && (
                              <Space>
                                <div>
                                  <Text style={{ color: "#9CA3AF", fontSize: "12px", display: "block" }}>Min Techs</Text>
                                  <InputNumber
                                    value={shiftTypeLimits[shift].min}
                                    onChange={(val) => updateShiftTypeLimit(shift, 'min', val || 1)}
                                    min={0}
                                    max={10}
                                    size="small"
                                  />
                                </div>
                                <div>
                                  <Text style={{ color: "#9CA3AF", fontSize: "12px", display: "block" }}>Max Techs</Text>
                                  <InputNumber
                                    value={shiftTypeLimits[shift].max}
                                    onChange={(val) => updateShiftTypeLimit(shift, 'max', val || 3)}
                                    min={1}
                                    max={20}
                                    size="small"
                                  />
                                </div>
                              </Space>
                            )}
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </Collapse>
                </>
              )}
            </div>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={editingTemplate ? "Edit Shift Template" : "Add Shift Template"}
        open={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={templateForm} layout="vertical" onFinish={handleSaveTemplate}>
          <Form.Item name="name" label="Shift Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., Morning, Mid, Late, or custom name like 'Early Bird'" />
          </Form.Item>
          <Form.Item name="start_time" label="Start Time" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="end_time" label="End Time" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: "#2E7D32" }}>
                {editingTemplate ? "Update" : "Add"}
              </Button>
              <Button onClick={() => setTemplateModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};