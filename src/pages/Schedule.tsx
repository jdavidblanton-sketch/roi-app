import React, { useState, useEffect } from "react";
import { Table, Button, Select, Card, message, Switch, Space, Alert, Tag, Radio, Modal, Checkbox } from "antd";
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

interface OperationalHours {
  monday: { open: string | null; close: string | null };
  tuesday: { open: string | null; close: string | null };
  wednesday: { open: string | null; close: string | null };
  thursday: { open: string | null; close: string | null };
  friday: { open: string | null; close: string | null };
  saturday: { open: string | null; close: string | null };
  sunday: { open: string | null; close: string | null };
}

interface WorkWeek {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

interface ShopSettings {
  work_week: WorkWeek;
  operational_hours: OperationalHours;
}

const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const getWeekDates = (offset: number = 0) => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
  return daysOfWeek.map((day, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    return { name: dayLabels[index], dayKey: day, date: date.toISOString().split("T")[0], display: `${dayLabels[index].slice(0,3)} ${date.getMonth() + 1}/${date.getDate()}` };
  });
};

const getMonthWeeks = (offset: number = 0) => {
  const today = new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const weeks: { weekNumber: number; dates: { name: string; dayKey: string; date: string; display: string }[] }[] = [];
  let currentWeek: { name: string; dayKey: string; date: string; display: string }[] = [];
  let weekCounter = 1;
  
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const dayKey = daysOfWeek[dayLabels.indexOf(dayName)];
    currentWeek.push({
      name: dayName,
      dayKey: dayKey,
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

const calculateTotalHours = (techId: string, schedule: Record<string, Record<string, string>>, dates: any[]) => {
  let total = 0;
  for (const day of dates) {
    const shiftValue = schedule[techId]?.[day.date] || "off";
    if (shiftValue === "morning" || shiftValue === "mid" || shiftValue === "late") total += 8;
  }
  return total;
};

const getAvailableShiftsForDay = (operationalHours: { open: string | null; close: string | null }) => {
  if (!operationalHours.open || !operationalHours.close) {
    return [{ value: "off", label: "OFF", hours: 0, timeRange: "" }];
  }
  
  const openHour = parseFloat(operationalHours.open.split(":")[0]) + parseFloat(operationalHours.open.split(":")[1]) / 60;
  const closeHour = parseFloat(operationalHours.close.split(":")[0]) + parseFloat(operationalHours.close.split(":")[1]) / 60;
  
  const morningStart = 7.5;
  const morningEnd = 16.0;
  const midStart = 8.5;
  const midEnd = 17.0;
  const lateStart = 9.5;
  const lateEnd = 18.0;
  
  const availableShifts = [{ value: "off", label: "OFF", hours: 0, timeRange: "" }];
  
  if (morningStart >= openHour && morningEnd <= closeHour) {
    availableShifts.push({ value: "morning", label: "Morning (7:30am-4:00pm)", hours: 8, timeRange: "7:30-16:00" });
  }
  if (midStart >= openHour && midEnd <= closeHour) {
    availableShifts.push({ value: "mid", label: "Mid (8:30am-5:00pm)", hours: 8, timeRange: "8:30-17:00" });
  }
  if (lateStart >= openHour && lateEnd <= closeHour) {
    availableShifts.push({ value: "late", label: "Late (9:30am-6:00pm)", hours: 8, timeRange: "9:30-18:00" });
  }
  
  return availableShifts;
};

const ensureCoverage = (
  techSchedules: Record<string, Record<string, string>>, 
  technicians: Technician[], 
  dates: any[],
  operationalHours: OperationalHours
): Record<string, Record<string, string>> => {
  const newSchedules = { ...techSchedules };
  
  for (const date of dates) {
    const dayHours = operationalHours[date.dayKey as keyof OperationalHours];
    if (!dayHours.open || !dayHours.close) {
      for (const tech of technicians) {
        if (!newSchedules[tech.id]) newSchedules[tech.id] = {};
        newSchedules[tech.id][date.date] = "off";
      }
      continue;
    }
    
    const validShifts = getAvailableShiftsForDay(dayHours).filter(s => s.value !== "off").map(s => s.value);
    const coveredShifts: Record<string, boolean> = {};
    for (const shift of validShifts) coveredShifts[shift] = false;
    
    for (const tech of technicians) {
      const shift = newSchedules[tech.id]?.[date.date];
      if (shift && validShifts.includes(shift)) coveredShifts[shift] = true;
    }
    
    for (const shiftType of validShifts) {
      if (!coveredShifts[shiftType]) {
        const availableTech = technicians.find(tech => {
          const currentShift = newSchedules[tech.id]?.[date.date];
          return (!currentShift || currentShift === "off") && 
                 tech.primary_day_off !== date.name && 
                 tech.secondary_day_off !== date.name;
        });
        if (availableTech) {
          if (!newSchedules[availableTech.id]) newSchedules[availableTech.id] = {};
          newSchedules[availableTech.id][date.date] = shiftType;
        }
      }
    }
  }
  return newSchedules;
};

export const Schedule: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly" | "rotational">("weekly");
  const [currentOffset, setCurrentOffset] = useState(0);
  const [weekDates, setWeekDates] = useState(getWeekDates(0));
  const [monthWeeks, setMonthWeeks] = useState(getMonthWeeks(0));
  const [schedule, setSchedule] = useState<Record<string, Record<string, string>>>({});
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
      loadAllData(shopId);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "weekly") setWeekDates(getWeekDates(currentOffset));
    else if (viewMode === "monthly") setMonthWeeks(getMonthWeeks(currentOffset));
    else if (viewMode === "rotational") setWeekDates(getWeekDates(0));
  }, [viewMode, currentOffset]);

  useEffect(() => {
    if (currentShopId && settingsLoaded && technicians.length > 0 && (viewMode === "weekly" || viewMode === "rotational")) {
      loadSchedule(weekDates.map(d => d.date));
    }
  }, [weekDates, settingsLoaded]);

  const loadAllData = async (shopId: string) => {
    setLoading(true);
    try {
      const { data: techData, error: techError } = await supabaseClient
        .from("technicians")
        .select("id, first_name, last_name, min_hours, max_hours, primary_day_off, secondary_day_off")
        .eq("shop_id", shopId);
      if (techError) throw techError;
      setTechnicians(techData || []);
      
      const { data: settingsData, error: settingsError } = await supabaseClient
        .from("shop_settings")
        .select("*")
        .eq("shop_id", shopId)
        .single();
      
      let settings: ShopSettings;
      if (settingsData) {
        settings = {
          work_week: settingsData.work_week,
          operational_hours: settingsData.operational_hours,
        };
      } else {
        settings = {
          work_week: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
          operational_hours: {
            monday: { open: "07:30", close: "18:00" },
            tuesday: { open: "07:30", close: "18:00" },
            wednesday: { open: "07:30", close: "18:00" },
            thursday: { open: "07:30", close: "18:00" },
            friday: { open: "07:30", close: "18:00" },
            saturday: { open: "08:00", close: "16:00" },
            sunday: { open: null, close: null },
          },
        };
      }
      setShopSettings(settings);
      setSettingsLoaded(true);
      
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
    technicians.forEach((tech) => {
      scheduleMap[tech.id] = {};
      dateStrings.forEach((date) => {
        const existing = scheduleData?.find((s: any) => s.tech_id === tech.id && s.date === date);
        scheduleMap[tech.id][date] = existing?.shift || "off";
      });
    });
    setSchedule(scheduleMap);
    checkViolations(scheduleMap, technicians);
  };

  const checkViolations = (currentSchedule: Record<string, Record<string, string>>, techs: Technician[]) => {
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
      const totalHours = calculateTotalHours(tech.id, currentSchedule, dates);
      if (tech.min_hours > 0 && totalHours < tech.min_hours) {
        techViolations.push(`Hours (${totalHours}) below minimum (${tech.min_hours})`);
      }
      if (tech.max_hours > 0 && totalHours > tech.max_hours) {
        techViolations.push(`Hours (${totalHours}) above maximum (${tech.max_hours})`);
      }
      if (techViolations.length > 0) newViolations[tech.id] = techViolations;
    }
    setViolations(newViolations);
  };

  const handleShiftChange = (techId: string, date: string, shiftType: string) => {
    const newSchedule = { ...schedule, [techId]: { ...schedule[techId], [date]: shiftType } };
    setSchedule(newSchedule);
    checkViolations(newSchedule, technicians);
  };

  const handleAutoSchedule = () => {
    if (!shopSettings) {
      message.error("Shop settings not loaded");
      return;
    }
    
    const dates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates;
    const operationalHours = shopSettings.operational_hours;
    const workWeek = shopSettings.work_week;
    const newSchedule: Record<string, Record<string, string>> = {};
    
    for (const tech of technicians) {
      newSchedule[tech.id] = {};
      let shiftIndex = 0;
      const shiftPool = ["morning", "mid", "late"];
      
      for (const day of dates) {
        const dayHours = operationalHours[day.dayKey as keyof OperationalHours];
        const isShopOpen = workWeek[day.dayKey as keyof WorkWeek] && dayHours?.open && dayHours?.close;
        
        if (!isShopOpen) {
          newSchedule[tech.id][day.date] = "off";
          continue;
        }
        
        if (tech.primary_day_off === day.name || tech.secondary_day_off === day.name) {
          newSchedule[tech.id][day.date] = "off";
          continue;
        }
        
        const validShifts = getAvailableShiftsForDay(dayHours).filter(s => s.value !== "off").map(s => s.value);
        if (validShifts.length === 0) {
          newSchedule[tech.id][day.date] = "off";
        } else {
          if (viewMode === "rotational") {
            newSchedule[tech.id][day.date] = validShifts[shiftIndex % validShifts.length];
            shiftIndex++;
          } else {
            newSchedule[tech.id][day.date] = validShifts[0];
          }
        }
      }
    }
    
    const finalSchedule = ensureCoverage(newSchedule, technicians, dates, operationalHours);
    setSchedule(finalSchedule);
    checkViolations(finalSchedule, technicians);
    message.success(viewMode === "rotational" ? "Rotational schedule generated." : "Auto-schedule applied.");
  };

  const handleSaveSchedule = async () => {
    if (!currentShopId) return;
    if (Object.keys(violations).length > 0 && !window.confirm("There are violations. Save anyway?")) return;
    
    setLoading(true);
    try {
      const dates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates).map(d => d.date) : weekDates.map(d => d.date);
      await supabaseClient.from("schedule").delete().eq("shop_id", currentShopId).in("date", dates);
      
      const newEntries: any[] = [];
      for (const tech of technicians) {
        for (const day of (viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates)) {
          const shiftValue = schedule[tech.id]?.[day.date] || "off";
          if (shiftValue !== "off") {
            newEntries.push({ shop_id: currentShopId, tech_id: tech.id, date: day.date, shift: shiftValue, lunch_deducted: 0.5 });
          }
        }
      }
      if (newEntries.length > 0) await supabaseClient.from("schedule").insert(newEntries);
      message.success("Schedule saved!");
    } catch (error) {
      console.error(error);
      message.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    setCurrentOffset(prev => direction === 'prev' ? prev - 1 : prev + 1);
  };

  const getPeriodLabel = () => {
    if (viewMode === "weekly") return `Week of ${weekDates[0]?.date}`;
    if (viewMode === "monthly") {
      const targetMonth = new Date(new Date().getFullYear(), new Date().getMonth() + currentOffset, 1);
      return targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return "Rotational Schedule";
  };

  const displayDates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates;
  
  const columns = [
    { title: "Tech", dataIndex: "name", key: "name", fixed: "left" as const, width: 60 },
    ...displayDates.map((day) => ({
      title: day.display,
      key: day.date,
      width: 100,
      render: (_: any, record: any) => {
        const shiftValue = schedule[record.id]?.[day.date] || "off";
        let availableShifts = [{ value: "off", label: "OFF" }, { value: "morning", label: "MORN" }, { value: "mid", label: "MID" }, { value: "late", label: "LATE" }];
        
        if (shopSettings) {
          const dayHours = shopSettings.operational_hours[day.dayKey as keyof OperationalHours];
          const isShopOpen = shopSettings.work_week[day.dayKey as keyof WorkWeek] && dayHours?.open && dayHours?.close;
          if (!isShopOpen) {
            availableShifts = [{ value: "off", label: "CLOSED" }];
          } else {
            const valid = getAvailableShiftsForDay(dayHours).filter(s => s.value !== "off").map(s => s.value);
            availableShifts = [{ value: "off", label: "OFF" }];
            if (valid.includes("morning")) availableShifts.push({ value: "morning", label: "MORN" });
            if (valid.includes("mid")) availableShifts.push({ value: "mid", label: "MID" });
            if (valid.includes("late")) availableShifts.push({ value: "late", label: "LATE" });
          }
        }
        
        return (
          <Select
            value={shiftValue}
            onChange={(v) => handleShiftChange(record.id, day.date, v)}
            style={{ width: "100%" }}
            size="small"
          >
            {availableShifts.map((s) => (<Option key={s.value} value={s.value}>{s.label}</Option>))}
          </Select>
        );
      },
    })),
    { title: "Hrs", dataIndex: "hours", key: "hours", width: 45, render: (_: any, record: any) => calculateTotalHours(record.id, schedule, displayDates) },
  ];

  const dataSource = technicians.map((tech) => ({
    key: tech.id,
    id: tech.id,
    name: `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`,
    hours: calculateTotalHours(tech.id, schedule, displayDates),
  }));

  return (
    <div style={{ padding: "24px" }}>
      <Card style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "16px" }}>
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
            {viewMode === "weekly" && <Button icon={<CopyOutlined />} onClick={() => setCopyModalVisible(true)} size="small">Copy Month</Button>}
          </Space>
          <Space>
            <Switch checked={autoMode} onChange={setAutoMode} size="small" />
            <span style={{ color: "#E5E7EB", fontSize: "12px" }}>{autoMode ? "Auto" : "Manual"}</span>
            {autoMode && <Button icon={<ThunderboltOutlined />} onClick={handleAutoSchedule} style={{ backgroundColor: "#2E7D32", color: "#FFF" }} size="small">Generate</Button>}
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveSchedule} loading={loading} size="small">Save</Button>
          </Space>
        </div>
        <Table columns={columns} dataSource={dataSource} loading={loading} pagination={false} size="small" scroll={{ x: displayDates.length * 100 }} />
      </Card>
      <Modal title="Copy to Month" open={copyModalVisible} onOk={() => setCopyModalVisible(false)} onCancel={() => setCopyModalVisible(false)} footer={null}>
        <Checkbox.Group onChange={setSelectedWeeks} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
          {monthWeeks.map((week, idx) => (<Checkbox key={idx} value={idx + 1}>Week {week.weekNumber} ({week.dates[0]?.display} - {week.dates[week.dates.length-1]?.display})</Checkbox>))}
        </Checkbox.Group>
        <Button type="primary" style={{ marginTop: 16, backgroundColor: "#2E7D32" }} onClick={() => setCopyModalVisible(false)}>Copy</Button>
      </Modal>
    </div>
  );
};