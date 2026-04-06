import React, { useState, useEffect } from "react";
import { Table, Button, Select, Card, message, Switch, Space, Alert, Tag, Input, Tooltip, Radio, Modal, Checkbox } from "antd";
import { SaveOutlined, ThunderboltOutlined, LeftOutlined, RightOutlined, CopyOutlined } from "@ant-design/icons";
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

interface Shift {
  value: string;
  label: string;
  hours: number;
  timeRange: string;
}

const shifts: Shift[] = [
  { value: "off", label: "OFF", hours: 0, timeRange: "" },
  { value: "morning", label: "Morning (7:30am-4:00pm)", hours: 8, timeRange: "7:30-16:00" },
  { value: "mid", label: "Mid (8:30am-5:00pm)", hours: 8, timeRange: "8:30-17:00" },
  { value: "late", label: "Late (9:30am-6:00pm)", hours: 8, timeRange: "9:30-18:00" },
  { value: "manual", label: "Manual", hours: 0, timeRange: "" },
];

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const shiftOptions = ["morning", "mid", "late"];

const getWeekDates = (offset: number = 0) => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
  return daysOfWeek.map((day, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    return { name: day, date: date.toISOString().split("T")[0], display: `${day.slice(0,3)} ${date.getMonth() + 1}/${date.getDate()}` };
  });
};

const getMonthWeeks = (offset: number = 0) => {
  const today = new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const weeks: { weekNumber: number; dates: { name: string; date: string; display: string }[] }[] = [];
  let currentWeek: { name: string; date: string; display: string }[] = [];
  let weekCounter = 1;
  
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    currentWeek.push({
      name: dayName,
      date: d.toISOString().split("T")[0],
      display: `${dayName.slice(0,3)} ${d.getMonth() + 1}/${d.getDate()}`,
    });
    
    if (dayName === "Sunday" || d.getTime() === lastDay.getTime()) {
      weeks.push({ weekNumber: weekCounter, dates: [...currentWeek] });
      currentWeek = [];
      weekCounter++;
    }
  }
  
  return weeks;
};

const calculateTotalHours = (techId: string, schedule: Record<string, Record<string, string>>, dates: any[], manualTimes: Record<string, Record<string, string>>) => {
  let total = 0;
  for (const day of dates) {
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

// Ensure all shifts are covered (at least one tech per shift type)
const ensureCoverage = (techSchedules: Record<string, Record<string, string>>, technicians: Technician[], dates: any[]): Record<string, Record<string, string>> => {
  const newSchedules = { ...techSchedules };
  
  for (const date of dates) {
    // Track which shifts are covered on this date
    const coveredShifts = { morning: false, mid: false, late: false };
    
    // Check current coverage
    for (const tech of technicians) {
      const shift = newSchedules[tech.id]?.[date.date];
      if (shift === "morning") coveredShifts.morning = true;
      if (shift === "mid") coveredShifts.mid = true;
      if (shift === "late") coveredShifts.late = true;
    }
    
    // Assign uncovered shifts to available techs who aren't off that day
    for (const shiftType of ["morning", "mid", "late"] as const) {
      if (!coveredShifts[shiftType]) {
        // Find a tech who is not off this day
        const availableTech = technicians.find(tech => {
          const currentShift = newSchedules[tech.id]?.[date.date];
          return currentShift !== "off" && tech.primary_day_off !== date.name && tech.secondary_day_off !== date.name;
        });
        if (availableTech) {
          if (!newSchedules[availableTech.id]) newSchedules[availableTech.id] = {};
          newSchedules[availableTech.id][date.date] = shiftType;
          coveredShifts[shiftType] = true;
        }
      }
    }
  }
  
  return newSchedules;
};

// Generate rotational schedule for a technician
const generateRotationalSchedule = (tech: Technician, weekDates: { name: string; date: string; display: string }[]): Record<string, string> => {
  const weekSchedule: Record<string, string> = {};
  const shiftPool = ["morning", "mid", "late"];
  
  const techIndex = parseInt(tech.id.slice(-2), 16) || 0;
  let currentShiftIndex = techIndex % shiftPool.length;
  
  for (const day of weekDates) {
    if (tech.primary_day_off === day.name || tech.secondary_day_off === day.name) {
      weekSchedule[day.date] = "off";
    } else {
      weekSchedule[day.date] = shiftPool[currentShiftIndex % shiftPool.length];
      currentShiftIndex++;
    }
  }
  
  return weekSchedule;
};

export const Schedule: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly" | "rotational">("weekly");
  const [currentOffset, setCurrentOffset] = useState(0);
  const [weekDates, setWeekDates] = useState(getWeekDates(0));
  const [monthWeeks, setMonthWeeks] = useState(getMonthWeeks(0));
  const [schedule, setSchedule] = useState<Record<string, Record<string, string>>>({});
  const [manualTimes, setManualTimes] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [violations, setViolations] = useState<Record<string, string[]>>({});
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);

  useEffect(() => {
    const shopId = localStorage.getItem("currentShopId");
    if (shopId) {
      setCurrentShopId(shopId);
      loadData(shopId);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "weekly") {
      setWeekDates(getWeekDates(currentOffset));
    } else if (viewMode === "monthly") {
      setMonthWeeks(getMonthWeeks(currentOffset));
    } else if (viewMode === "rotational") {
      setWeekDates(getWeekDates(0));
    }
  }, [viewMode, currentOffset]);

  useEffect(() => {
    if (currentShopId && technicians.length > 0) {
      if (viewMode === "weekly" || viewMode === "rotational") {
        loadSchedule(weekDates.map(d => d.date));
      }
    }
  }, [weekDates, technicians]);

  const loadData = async (shopId: string) => {
    setLoading(true);
    try {
      const { data: techData, error: techError } = await supabaseClient
        .from("technicians")
        .select("id, first_name, last_name, min_hours, max_hours, primary_day_off, secondary_day_off")
        .eq("shop_id", shopId);

      if (techError) throw techError;
      setTechnicians(techData || []);
      
      await loadSchedule(weekDates.map(d => d.date));
    } catch (error) {
      console.error("Error loading data:", error);
      message.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (dateStrings: string[]) => {
    if (!currentShopId) return;
    
    const { data: scheduleData, error: scheduleError } = await supabaseClient
      .from("schedule")
      .select("*")
      .eq("shop_id", currentShopId)
      .in("date", dateStrings);

    if (scheduleError) throw scheduleError;

    const scheduleMap: Record<string, Record<string, string>> = {};
    const manualTimesMap: Record<string, Record<string, string>> = {};
    
    technicians.forEach((tech) => {
      scheduleMap[tech.id] = {};
      dateStrings.forEach((date) => {
        const existing = scheduleData?.find((s: any) => s.tech_id === tech.id && s.date === date);
        scheduleMap[tech.id][date] = existing?.shift || "off";
        if (existing?.shift === "manual" && existing?.shift_start && existing?.shift_end) {
          if (!manualTimesMap[tech.id]) manualTimesMap[tech.id] = {};
          manualTimesMap[tech.id][date] = `${existing.shift_start}-${existing.shift_end}`;
        }
      });
    });
    
    setSchedule(scheduleMap);
    setManualTimes(manualTimesMap);
    checkViolations(scheduleMap, technicians, manualTimesMap);
  };

  const checkViolations = (currentSchedule: Record<string, Record<string, string>>, techs: Technician[], currentManualTimes: Record<string, Record<string, string>>) => {
    const newViolations: Record<string, string[]> = {};
    const dates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates;
    
    for (const tech of techs) {
      const techViolations: string[] = [];
      
      for (const day of dates) {
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
      
      const totalHours = calculateTotalHours(tech.id, currentSchedule, dates, currentManualTimes);
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
    let newSchedule: Record<string, Record<string, string>> = { ...schedule };
    const dates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates;
    
    for (const tech of technicians) {
      if (!newSchedule[tech.id]) {
        newSchedule[tech.id] = {};
      }
      
      if (viewMode === "rotational") {
        const rotationalSchedule = generateRotationalSchedule(tech, dates);
        for (const date of dates.map(d => d.date)) {
          newSchedule[tech.id][date] = rotationalSchedule[date] || "off";
        }
      } else {
        for (const day of dates) {
          if (tech.primary_day_off === day.name || tech.secondary_day_off === day.name) {
            newSchedule[tech.id][day.date] = "off";
          } else if (!newSchedule[tech.id][day.date] || newSchedule[tech.id][day.date] === "off") {
            newSchedule[tech.id][day.date] = "morning";
          }
        }
      }
    }
    
    // Ensure open to close coverage (all shifts covered)
    newSchedule = ensureCoverage(newSchedule, technicians, dates);
    
    setSchedule(newSchedule);
    setManualTimes({});
    checkViolations(newSchedule, technicians, {});
    message.success(viewMode === "rotational" ? "Rotational schedule generated with full shift coverage." : "Auto-schedule applied with full shift coverage.");
  };

  const handleCopyToMonth = () => {
    setCopyModalVisible(true);
    setSelectedWeeks([]);
  };

  const handleConfirmCopyToMonth = async () => {
    if (selectedWeeks.length === 0) {
      message.error("Please select at least one week to copy to");
      return;
    }
    
    setLoading(true);
    try {
      const sourceDates = weekDates.map(d => d.date);
      const targetWeeks = monthWeeks.filter((_, idx) => selectedWeeks.includes(idx + 1));
      const targetDates = targetWeeks.flatMap(w => w.dates.map(d => d.date));
      
      const newSchedule = { ...schedule };
      
      for (const tech of technicians) {
        for (const targetDate of targetDates) {
          const targetDayName = targetWeeks.flatMap(w => w.dates).find(d => d.date === targetDate)?.name;
          const sourceDate = sourceDates.find((_, idx) => weekDates[idx]?.name === targetDayName);
          if (sourceDate && newSchedule[tech.id]?.[sourceDate]) {
            newSchedule[tech.id][targetDate] = newSchedule[tech.id][sourceDate];
          }
        }
      }
      
      setSchedule(newSchedule);
      
      const allEntries: any[] = [];
      for (const tech of technicians) {
        for (const targetDate of targetDates) {
          const shiftValue = newSchedule[tech.id]?.[targetDate] || "off";
          if (shiftValue !== "off") {
            const shift = shifts.find(s => s.value === shiftValue);
            allEntries.push({
              shop_id: currentShopId,
              tech_id: tech.id,
              date: targetDate,
              shift: shiftValue,
              shift_start: shift?.timeRange.split("-")[0] || null,
              shift_end: shift?.timeRange.split("-")[1] || null,
              lunch_deducted: shiftValue !== "off" && shiftValue !== "manual" ? 0.5 : 0,
            });
          }
        }
      }
      
      if (allEntries.length > 0) {
        await supabaseClient.from("schedule").upsert(allEntries);
      }
      
      message.success(`Copied weekly schedule to ${selectedWeeks.length} week(s) in the month`);
      setCopyModalVisible(false);
      loadSchedule([...new Set([...weekDates.map(d => d.date), ...targetDates])]);
    } catch (error) {
      console.error("Error copying to month:", error);
      message.error("Failed to copy schedule");
    } finally {
      setLoading(false);
    }
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
      const dates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates).map(d => d.date) : weekDates.map(d => d.date);
      await supabaseClient
        .from("schedule")
        .delete()
        .eq("shop_id", currentShopId)
        .in("date", dates);

      const newEntries: any[] = [];
      for (const tech of technicians) {
        for (const day of (viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates)) {
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

  const handleNavigate = (direction: 'prev' | 'next') => {
    setCurrentOffset(prev => direction === 'prev' ? prev - 1 : prev + 1);
  };

  const getPeriodLabel = () => {
    if (viewMode === "weekly") {
      const start = weekDates[0]?.date;
      const end = weekDates[6]?.date;
      return `Week of ${start}`;
    } else if (viewMode === "monthly") {
      const date = new Date();
      const targetMonth = new Date(date.getFullYear(), date.getMonth() + currentOffset, 1);
      return targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return "Rotational Schedule (Auto only)";
    }
  };

  const displayDates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates;
  
  // Reduced column width for no horizontal scroll
  const columns = [
    { title: "Tech", dataIndex: "name", key: "name", fixed: "left" as const, width: 100 },
    ...displayDates.map((day) => ({
      title: day.display,
      key: day.date,
      width: 130,
      render: (_: any, record: any) => {
        const tech = technicians.find(t => t.id === record.id);
        const isDayOff = tech && (tech.primary_day_off === day.name || tech.secondary_day_off === day.name);
        const shiftValue = schedule[record.id]?.[day.date] || "off";
        const isManual = shiftValue === "manual";
        const manualTimeValue = manualTimes[record.id]?.[day.date] || "";
        
        // In auto mode, only show shift options (no manual)
        const availableShifts = autoMode ? shifts.filter(s => s.value !== "manual") : shifts;
        
        return (
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Select
              value={shiftValue}
              onChange={(v) => handleShiftChange(record.id, day.date, v)}
              style={{ width: "100%" }}
              size="small"
              status={isDayOff && shiftValue !== "off" ? "warning" : undefined}
              disabled={viewMode === "rotational" && !autoMode}
            >
              {availableShifts.map((s) => (<Option key={s.value} value={s.value}>{s.label}</Option>))}
            </Select>
            {isManual && !autoMode && (
              <Input
                placeholder="e.g., 9:00am-5:00pm"
                value={manualTimeValue}
                onChange={(e) => handleManualTimeChange(record.id, day.date, e.target.value)}
                size="small"
                addonBefore="Hours"
              />
            )}
            {!isManual && shiftValue !== "off" && (
              <Tag color="blue" style={{ fontSize: "10px", margin: 0 }}>🍱 -0.5hr</Tag>
            )}
          </Space>
        );
      },
    })),
    {
      title: "Total Hrs",
      key: "totalHours",
      width: 80,
      fixed: "right" as const,
      render: (_: any, record: any) => {
        const total = calculateTotalHours(record.id, schedule, displayDates, manualTimes);
        const tech = technicians.find(t => t.id === record.id);
        let status = "";
        if (tech) {
          if (tech.min_hours > 0 && total < tech.min_hours) status = "warning";
          if (tech.max_hours > 0 && total > tech.max_hours) status = "error";
        }
        return (
          <Tooltip title={status === "warning" ? "Below min" : status === "error" ? "Above max" : "OK"}>
            <Tag color={status === "warning" ? "orange" : status === "error" ? "red" : "green"}>{total.toFixed(0)}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Issues",
      key: "violations",
      width: 100,
      fixed: "right" as const,
      render: (_: any, record: any) => {
        const techViolations = violations[record.id];
        if (!techViolations || techViolations.length === 0) {
          return <Tag color="green">OK</Tag>;
        }
        return <Tag color="orange" title={techViolations.join(", ")}>{techViolations.length}</Tag>;
      },
    },
  ];

  const dataSource = technicians.map((tech) => ({
    key: tech.id,
    id: tech.id,
    name: `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`,
  }));

  const hasAnyViolations = Object.keys(violations).length > 0;

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
            <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="weekly">Week</Radio.Button>
              <Radio.Button value="monthly">Month</Radio.Button>
              <Radio.Button value="rotational">Rotate</Radio.Button>
            </Radio.Group>
            
            {viewMode !== "rotational" && (
              <>
                <Button icon={<LeftOutlined />} onClick={() => handleNavigate('prev')} size="small">Prev</Button>
                <span style={{ color: "#E5E7EB", fontSize: "12px" }}>{getPeriodLabel()}</span>
                <Button icon={<RightOutlined />} onClick={() => handleNavigate('next')} size="small">Next</Button>
              </>
            )}
            
            {viewMode === "weekly" && (
              <Button icon={<CopyOutlined />} onClick={handleCopyToMonth} size="small">Copy Month</Button>
            )}
          </Space>
          
          <Space>
            <Switch
              checked={autoMode}
              onChange={setAutoMode}
              checkedChildren="Auto"
              unCheckedChildren="Manual"
              size="small"
            />
            <span style={{ color: "#E5E7EB", fontSize: "12px" }}>{autoMode ? "Auto" : "Manual"}</span>
            {autoMode && (
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleAutoSchedule}
                style={{ backgroundColor: "#2E7D32", color: "#FFF" }}
                size="small"
              >
                {viewMode === "rotational" ? "Rotate" : "Auto"}
              </Button>
            )}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveSchedule}
              style={{ backgroundColor: hasAnyViolations ? "#E65100" : "#2E7D32" }}
              loading={loading}
              size="small"
            >
              Save
            </Button>
          </Space>
        </div>

        {viewMode === "rotational" && !autoMode && (
          <Alert
            message="Enable Auto Mode for Rotational"
            description="Toggle Auto Mode above to generate rotational schedules."
            type="info"
            showIcon
            style={{ marginBottom: "12px", background: "rgba(46,125,50,0.2)", borderColor: "#2E7D32", padding: "8px" }}
          />
        )}

        {hasAnyViolations && (
          <Alert
            message={`${Object.keys(violations).length} techs have violations`}
            type="warning"
            showIcon
            style={{ marginBottom: "12px", background: "rgba(230,81,0,0.2)", borderColor: "#E65100", padding: "8px" }}
          />
        )}

        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: displayDates.length * 130 }}
        />
      </Card>

      <Modal
        title="Copy to Month"
        open={copyModalVisible}
        onOk={handleConfirmCopyToMonth}
        onCancel={() => setCopyModalVisible(false)}
        okText="Copy"
        cancelText="Cancel"
        width={400}
      >
        <p>Select weeks to copy current schedule to:</p>
        <Checkbox.Group onChange={(checked) => setSelectedWeeks(checked as number[])} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
          {monthWeeks.map((week, idx) => (
            <Checkbox key={idx} value={idx + 1}>
              Week {week.weekNumber} ({week.dates[0]?.display} - {week.dates[week.dates.length - 1]?.display})
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Modal>
    </div>
  );
};