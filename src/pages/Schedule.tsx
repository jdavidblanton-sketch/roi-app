import React, { useState, useEffect } from "react";
import { Table, Button, Select, Card, message, Switch, Space, Alert, Tag, Input, Tooltip, Spin } from "antd";
import { SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";

const { Option } = Select;

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  min_hours: number;
  max_hours: number;
  primary_day_off: string;
  secondary_day_off: string;
}

const shifts = [
  { value: "off", label: "OFF", hours: 0, timeRange: "" },
  { value: "morning", label: "Morning (7:30am - 4:00pm)", hours: 8, timeRange: "7:30-16:00" },
  { value: "mid", label: "Mid (8:30am - 5:00pm)", hours: 8, timeRange: "8:30-17:00" },
  { value: "late", label: "Late (9:30am - 6:00pm)", hours: 8, timeRange: "9:30-18:00" },
  { value: "manual", label: "Manual", hours: 0, timeRange: "" },
];

const getWeekDates = () => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return weekDays.map((day, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    return { name: day, date: date.toISOString().split("T")[0], display: `${day.slice(0,3)} ${date.getMonth() + 1}/${date.getDate()}` };
  });
};

const parseTimeToDecimal = (timeStr: string): number => {
  const match = timeStr.match(/(\d+):(\d+)\s*(am|pm)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]) / 60;
  const period = match[3]?.toLowerCase();
  
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  
  return hours + minutes;
};

const calculateTotalHours = (techId: string, schedule: Record<string, Record<string, string>>, weekDates: any[], manualTimes: Record<string, Record<string, string>>) => {
  let total = 0;
  for (const day of weekDates) {
    const shiftValue = schedule[techId]?.[day.date] || "off";
    if (shiftValue === "off") continue;
    
    if (shiftValue === "manual" && manualTimes[techId]?.[day.date]) {
      const timeRange = manualTimes[techId][day.date];
      const parts = timeRange.split("-");
      if (parts.length === 2) {
        const start = parseTimeToDecimal(parts[0].trim());
        const end = parseTimeToDecimal(parts[1].trim());
        let hours = end - start;
        if (hours < 0) hours += 24;
        total += Math.max(0, hours - 0.5);
      }
    } else {
      const shift = shifts.find(s => s.value === shiftValue);
      if (shift && shift.hours > 0) {
        total += shift.hours;
      }
    }
  }
  return total;
};

export const Schedule: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [weekDates] = useState(getWeekDates());
  const [schedule, setSchedule] = useState<Record<string, Record<string, string>>>({});
  const [manualTimes, setManualTimes] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [violations, setViolations] = useState<Record<string, string[]>>({});
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const shopId = localStorage.getItem("currentShopId");
    console.log("Schedule page - Current shop ID:", shopId);
    
    if (shopId) {
      setCurrentShopId(shopId);
      loadData(shopId);
    } else {
      setIsInitializing(false);
    }
  }, []);

  const loadData = async (shopId: string) => {
    setLoading(true);
    try {
      const { data: techData, error: techError } = await supabaseClient
        .from("technicians")
        .select("id, first_name, last_name, min_hours, max_hours, primary_day_off, secondary_day_off")
        .eq("shop_id", shopId);

      if (techError) throw techError;
      setTechnicians(techData || []);

      const { data: scheduleData, error: scheduleError } = await supabaseClient
        .from("schedule")
        .select("*")
        .eq("shop_id", shopId);

      if (scheduleError) throw scheduleError;

      const scheduleMap: Record<string, Record<string, string>> = {};
      const manualTimesMap: Record<string, Record<string, string>> = {};
      
      techData?.forEach((tech) => {
        scheduleMap[tech.id] = {};
        weekDates.forEach((day) => {
          const existing = scheduleData?.find((s: any) => s.tech_id === tech.id && s.date === day.date);
          scheduleMap[tech.id][day.date] = existing?.shift || "off";
          if (existing?.shift === "manual" && existing?.shift_start && existing?.shift_end) {
            if (!manualTimesMap[tech.id]) manualTimesMap[tech.id] = {};
            manualTimesMap[tech.id][day.date] = `${existing.shift_start}-${existing.shift_end}`;
          }
        });
      });
      
      setSchedule(scheduleMap);
      setManualTimes(manualTimesMap);
      checkViolations(scheduleMap, techData || [], manualTimesMap);
    } catch (error) {
      console.error("Error loading data:", error);
      message.error("Failed to load schedule");
    } finally {
      setLoading(false);
      setIsInitializing(false);
    }
  };

  const checkViolations = (currentSchedule: Record<string, Record<string, string>>, techs: Technician[], currentManualTimes: Record<string, Record<string, string>>) => {
    const newViolations: Record<string, string[]> = {};
    
    for (const tech of techs) {
      const techViolations: string[] = [];
      
      for (const day of weekDates) {
        const shiftValue = currentSchedule[tech.id]?.[day.date] || "off";
        if (shiftValue !== "off") {
          if (tech.primary_day_off && tech.primary_day_off !== "None" && day.name === tech.primary_day_off) {
            techViolations.push(`Scheduled on primary day off (${tech.primary_day_off})`);
          }
          if (tech.secondary_day_off && tech.secondary_day_off !== "None" && day.name === tech.secondary_day_off) {
            techViolations.push(`Scheduled on secondary day off (${tech.secondary_day_off})`);
          }
        }
      }
      
      const totalHours = calculateTotalHours(tech.id, currentSchedule, weekDates, currentManualTimes);
      if (tech.min_hours > 0 && totalHours < tech.min_hours) {
        techViolations.push(`Hours (${totalHours.toFixed(1)}) below minimum (${tech.min_hours})`);
      }
      if (tech.max_hours > 0 && totalHours > tech.max_hours) {
        techViolations.push(`Hours (${totalHours.toFixed(1)}) above maximum (${tech.max_hours})`);
      }
      
      if (techViolations.length > 0) {
        newViolations[tech.id] = techViolations;
      }
    }
    setViolations(newViolations);
  };

  const handleShiftChange = (techId: string, date: string, shiftType: string) => {
    const newSchedule = {
      ...schedule,
      [techId]: { ...schedule[techId], [date]: shiftType },
    };
    setSchedule(newSchedule);
    
    if (shiftType !== "manual" && manualTimes[techId]?.[date]) {
      const newManual = { ...manualTimes };
      delete newManual[techId]?.[date];
      setManualTimes(newManual);
      checkViolations(newSchedule, technicians, newManual);
    } else {
      checkViolations(newSchedule, technicians, manualTimes);
    }
  };

  const handleManualTimeChange = (techId: string, date: string, timeRange: string) => {
    const newManual = { ...manualTimes };
    if (!newManual[techId]) newManual[techId] = {};
    newManual[techId][date] = timeRange;
    setManualTimes(newManual);
    checkViolations(schedule, technicians, newManual);
  };

  const handleAutoSchedule = () => {
    const newSchedule: Record<string, Record<string, string>> = { ...schedule };
    
    for (const tech of technicians) {
      if (!newSchedule[tech.id]) {
        newSchedule[tech.id] = {};
      }
      
      for (const day of weekDates) {
        if (tech.primary_day_off === day.name || tech.secondary_day_off === day.name) {
          newSchedule[tech.id][day.date] = "off";
        } else if (!newSchedule[tech.id][day.date] || newSchedule[tech.id][day.date] === "off") {
          newSchedule[tech.id][day.date] = "morning";
        }
      }
    }
    
    setSchedule(newSchedule);
    setManualTimes({});
    checkViolations(newSchedule, technicians, {});
    message.success("Auto-schedule applied.");
  };

  const handleSaveSchedule = async () => {
    if (!currentShopId) return;
    
    const hasViolations = Object.keys(violations).length > 0;
    if (hasViolations) {
      const confirmed = window.confirm("There are scheduling violations. Save anyway?");
      if (!confirmed) return;
    }
    
    setLoading(true);
    try {
      const weekDateStrings = weekDates.map(d => d.date);
      await supabaseClient
        .from("schedule")
        .delete()
        .eq("shop_id", currentShopId)
        .in("date", weekDateStrings);

      const newEntries: any[] = [];
      for (const tech of technicians) {
        for (const day of weekDates) {
          const shiftValue = schedule[tech.id]?.[day.date] || "off";
          if (shiftValue !== "off") {
            const shift = shifts.find(s => s.value === shiftValue);
            let shiftStart = shift?.timeRange.split("-")[0] || null;
            let shiftEnd = shift?.timeRange.split("-")[1] || null;
            
            if (shiftValue === "manual" && manualTimes[tech.id]?.[day.date]) {
              const timeRange = manualTimes[tech.id][day.date];
              const parts = timeRange.split("-");
              if (parts.length === 2) {
                shiftStart = parts[0].trim();
                shiftEnd = parts[1].trim();
              }
            }
            
            newEntries.push({
              shop_id: currentShopId,
              tech_id: tech.id,
              date: day.date,
              shift: shiftValue,
              shift_start: shiftStart,
              shift_end: shiftEnd,
              lunch_deducted: shiftValue !== "off" && shiftValue !== "manual" ? 0.5 : 0,
            });
          }
        }
      }

      if (newEntries.length > 0) {
        const { error } = await supabaseClient.from("schedule").insert(newEntries);
        if (error) throw error;
      }

      message.success("Schedule saved successfully!");
    } catch (error) {
      console.error("Error saving schedule:", error);
      message.error("Failed to save schedule");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Technician", dataIndex: "name", key: "name", fixed: "left" as const, width: 160 },
    ...weekDates.map((day) => ({
      title: day.display,
      key: day.date,
      width: 220,
      render: (_: any, record: any) => {
        const tech = technicians.find(t => t.id === record.id);
        const isDayOff = tech && (tech.primary_day_off === day.name || tech.secondary_day_off === day.name);
        const shiftValue = schedule[record.id]?.[day.date] || "off";
        const isManual = shiftValue === "manual";
        const manualTimeValue = manualTimes[record.id]?.[day.date] || "";
        
        return (
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Select
              value={shiftValue}
              onChange={(v) => handleShiftChange(record.id, day.date, v)}
              style={{ width: "100%" }}
              size="small"
              status={isDayOff && shiftValue !== "off" ? "warning" : undefined}
            >
              {shifts.map((s) => (<Option key={s.value} value={s.value}>{s.label}</Option>))}
            </Select>
            {isManual && (
              <Input
                placeholder="e.g., 9:00am-5:00pm"
                value={manualTimeValue}
                onChange={(e) => handleManualTimeChange(record.id, day.date, e.target.value)}
                size="small"
                addonBefore="Hours"
              />
            )}
            {!isManual && shiftValue !== "off" && (
              <Tag color="blue" style={{ fontSize: "10px", margin: 0 }}>🍱 -0.5hr lunch</Tag>
            )}
          </Space>
        );
      },
    })),
    {
      title: "Total Hours",
      key: "totalHours",
      width: 100,
      fixed: "right" as const,
      render: (_: any, record: any) => {
        const total = calculateTotalHours(record.id, schedule, weekDates, manualTimes);
        const tech = technicians.find(t => t.id === record.id);
        let status = "";
        if (tech) {
          if (tech.min_hours > 0 && total < tech.min_hours) status = "warning";
          if (tech.max_hours > 0 && total > tech.max_hours) status = "error";
        }
        return (
          <Tooltip title={status === "warning" ? "Below minimum hours" : status === "error" ? "Above maximum hours" : "Within limits"}>
            <Tag color={status === "warning" ? "orange" : status === "error" ? "red" : "green"}>{total.toFixed(1)} hrs</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Violations",
      key: "violations",
      width: 180,
      fixed: "right" as const,
      render: (_: any, record: any) => {
        const techViolations = violations[record.id];
        if (!techViolations || techViolations.length === 0) {
          return <Tag color="green">OK</Tag>;
        }
        return (
          <Space direction="vertical" size="small">
            {techViolations.map((v, i) => (
              <Tag key={i} color="orange" style={{ margin: 0 }}>{v}</Tag>
            ))}
          </Space>
        );
      },
    },
  ];

  const dataSource = technicians.map((tech) => ({
    key: tech.id,
    id: tech.id,
    name: `${tech.first_name} ${tech.last_name}`,
  }));

  const hasAnyViolations = Object.keys(violations).length > 0;

  if (isInitializing) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!currentShopId) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <Card>
          <h2>No Shop Selected</h2>
          <p>Please go back and select a shop to continue.</p>
          <Button type="primary" onClick={() => window.location.href = "/"}>
            Select Shop
          </Button>
        </Card>
      </div>
    );
  }

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <Space>
            <Switch
              checked={autoMode}
              onChange={setAutoMode}
              checkedChildren="Auto"
              unCheckedChildren="Manual"
            />
            <span style={{ color: "#E5E7EB" }}>{autoMode ? "Auto Mode" : "Manual Mode"}</span>
            {autoMode && (
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleAutoSchedule}
                style={{ backgroundColor: "#2E7D32", color: "#FFF" }}
              >
                Generate Auto Schedule
              </Button>
            )}
          </Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveSchedule}
            style={{ backgroundColor: hasAnyViolations ? "#E65100" : "#2E7D32" }}
            loading={loading}
          >
            Save Schedule
          </Button>
        </div>

        {hasAnyViolations && (
          <Alert
            message="Scheduling Violations Detected"
            description="Some technicians have day off conflicts or hours outside their min/max limits."
            type="warning"
            showIcon
            style={{ marginBottom: "16px", background: "rgba(230,81,0,0.2)", borderColor: "#E65100" }}
          />
        )}

        <Alert
          message="30-Minute Lunch Break"
          description="All shifts include a mandatory 30-minute unpaid lunch break. For manual shifts, enter start and end time (e.g., 9:00am-5:00pm)."
          type="info"
          showIcon
          style={{ marginBottom: "16px", background: "rgba(46,125,50,0.2)", borderColor: "#2E7D32" }}
        />

        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </Card>
    </div>
  );
};