import React, { useState, useEffect } from "react";
import { Table, Button, Select, Card, message, Switch, Space, Radio, Modal, Checkbox } from "antd";
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

interface AdvancedSettings {
  enable: boolean;
  day_overrides: { day: string; min_techs: number | null; max_techs: number | null }[];
  shift_type_limits: {
    morning: { min: number; max: number; enabled: boolean };
    mid: { min: number; max: number; enabled: boolean };
    late: { min: number; max: number; enabled: boolean };
  };
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

const calculateShiftHours = (operationalHours: { open: string | null; close: string | null }): number => {
  if (!operationalHours.open || !operationalHours.close) return 0;
  
  const openHour = parseFloat(operationalHours.open.split(":")[0]) + parseFloat(operationalHours.open.split(":")[1]) / 60;
  const closeHour = parseFloat(operationalHours.close.split(":")[0]) + parseFloat(operationalHours.close.split(":")[1]) / 60;
  const totalOpenHours = closeHour - openHour;
  
  // For short days, the shift takes the entire open hours minus lunch
  if (totalOpenHours < 8) {
    return Math.max(0, totalOpenHours - 0.5);
  }
  
  // For full days, standard shifts are 8 hours
  return 8;
};

const calculateTotalHours = (
  techId: string, 
  schedule: Record<string, Record<string, string>>, 
  dates: any[],
  operationalHours: OperationalHours
) => {
  let total = 0;
  for (const day of dates) {
    const shiftValue = schedule[techId]?.[day.date] || "off";
    if (shiftValue === "off") continue;
    
    const dayHours = operationalHours[day.dayKey as keyof OperationalHours];
    total += calculateShiftHours(dayHours);
  }
  return total;
};

const getAvailableShiftsForDay = (operationalHours: { open: string | null; close: string | null }) => {
  if (!operationalHours.open || !operationalHours.close) {
    return [];
  }
  
  const openHour = parseFloat(operationalHours.open.split(":")[0]) + parseFloat(operationalHours.open.split(":")[1]) / 60;
  const closeHour = parseFloat(operationalHours.close.split(":")[0]) + parseFloat(operationalHours.close.split(":")[1]) / 60;
  const totalOpenHours = closeHour - openHour;
  
  const availableShifts: string[] = [];
  
  if (totalOpenHours < 4) {
    return [];
  }
  
  if (totalOpenHours >= 4 && totalOpenHours < 8) {
    availableShifts.push("morning");
    return availableShifts;
  }
  
  if (totalOpenHours >= 8) {
    if (openHour <= 7.5 && closeHour >= 16.0) {
      availableShifts.push("morning");
    }
    if (openHour <= 8.5 && closeHour >= 17.0) {
      availableShifts.push("mid");
    }
    if (openHour <= 9.5 && closeHour >= 18.0) {
      availableShifts.push("late");
    }
    
    if (availableShifts.length === 0) {
      availableShifts.push("morning");
    }
  }
  
  return availableShifts;
};

const getEffectiveMinTechs = (
  day: string, 
  shiftType: string, 
  defaultMin: number,
  advancedSettings: AdvancedSettings | null
): number => {
  if (advancedSettings?.enable) {
    if (advancedSettings.shift_type_limits?.[shiftType as keyof typeof advancedSettings.shift_type_limits]?.enabled) {
      return advancedSettings.shift_type_limits[shiftType as keyof typeof advancedSettings.shift_type_limits].min;
    }
    const dayOverride = advancedSettings.day_overrides?.find((d) => d.day === day);
    if (dayOverride && dayOverride.min_techs !== null && dayOverride.min_techs !== undefined) {
      return dayOverride.min_techs;
    }
  }
  return defaultMin;
};

const getEffectiveMaxTechs = (
  day: string, 
  shiftType: string, 
  defaultMax: number,
  advancedSettings: AdvancedSettings | null
): number => {
  if (advancedSettings?.enable) {
    if (advancedSettings.shift_type_limits?.[shiftType as keyof typeof advancedSettings.shift_type_limits]?.enabled) {
      return advancedSettings.shift_type_limits[shiftType as keyof typeof advancedSettings.shift_type_limits].max;
    }
    const dayOverride = advancedSettings.day_overrides?.find((d) => d.day === day);
    if (dayOverride && dayOverride.max_techs !== null && dayOverride.max_techs !== undefined) {
      return dayOverride.max_techs;
    }
  }
  return defaultMax;
};

const distributeShifts = (
  technicians: Technician[],
  dates: any[],
  operationalHours: OperationalHours,
  workWeek: WorkWeek,
  autoRules: { min_techs_per_shift: number; max_techs_per_shift: number },
  advancedSettings: AdvancedSettings | null
): Record<string, Record<string, string>> => {
  const newSchedule: Record<string, Record<string, string>> = {};
  
  for (const tech of technicians) {
    newSchedule[tech.id] = {};
    for (const day of dates) {
      newSchedule[tech.id][day.date] = "off";
    }
  }
  
  for (const day of dates) {
    const dayKey = day.dayKey as keyof WorkWeek;
    const isShopOpenDay = workWeek[dayKey];
    const dayHours = operationalHours[day.dayKey as keyof OperationalHours];
    const hasOperationalHours = dayHours?.open && dayHours?.close;
    
    if (!isShopOpenDay || !hasOperationalHours) {
      continue;
    }
    
    const availableShifts = getAvailableShiftsForDay(dayHours);
    if (availableShifts.length === 0) {
      continue;
    }
    
    const availableTechs = technicians.filter(tech => 
      tech.primary_day_off !== day.name && tech.secondary_day_off !== day.name
    );
    
    if (availableTechs.length === 0) continue;
    
    // Assign each shift type
    for (const shift of availableShifts) {
      const minTechs = getEffectiveMinTechs(day.dayKey, shift, autoRules.min_techs_per_shift, advancedSettings);
      const maxTechs = getEffectiveMaxTechs(day.dayKey, shift, autoRules.max_techs_per_shift, advancedSettings);
      
      // Get unassigned techs for this day
      const unassignedTechs = availableTechs.filter(tech => 
        !newSchedule[tech.id][day.date] || newSchedule[tech.id][day.date] === "off"
      );
      
      // Determine how many to assign
      const toAssign = Math.min(maxTechs, unassignedTechs.length, Math.max(minTechs, Math.ceil(availableTechs.length / availableShifts.length)));
      
      for (let i = 0; i < toAssign && i < unassignedTechs.length; i++) {
        const tech = unassignedTechs[i];
        newSchedule[tech.id][day.date] = shift;
      }
    }
  }
  
  return newSchedule;
};

const rotateShifts = (
  technicians: Technician[],
  dates: any[],
  operationalHours: OperationalHours,
  workWeek: WorkWeek
): Record<string, Record<string, string>> => {
  const newSchedule: Record<string, Record<string, string>> = {};
  
  for (const tech of technicians) {
    newSchedule[tech.id] = {};
    let shiftRotation = 0;
    
    for (const day of dates) {
      const dayKey = day.dayKey as keyof WorkWeek;
      const isShopOpenDay = workWeek[dayKey];
      const dayHours = operationalHours[day.dayKey as keyof OperationalHours];
      const hasOperationalHours = dayHours?.open && dayHours?.close;
      
      if (!isShopOpenDay || !hasOperationalHours) {
        newSchedule[tech.id][day.date] = "off";
        continue;
      }
      
      if (tech.primary_day_off === day.name || tech.secondary_day_off === day.name) {
        newSchedule[tech.id][day.date] = "off";
        continue;
      }
      
      const availableShifts = getAvailableShiftsForDay(dayHours);
      if (availableShifts.length === 0) {
        newSchedule[tech.id][day.date] = "off";
      } else {
        const shiftToAssign = availableShifts[shiftRotation % availableShifts.length];
        newSchedule[tech.id][day.date] = shiftToAssign;
        shiftRotation++;
      }
    }
  }
  
  return newSchedule;
};

export const Schedule: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [shopSettings, setShopSettings] = useState<{ 
    work_week: WorkWeek; 
    operational_hours: OperationalHours; 
    auto_schedule_rules: any; 
    advanced_settings: AdvancedSettings | null 
  } | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly" | "rotational">("weekly");
  const [currentOffset, setCurrentOffset] = useState(0);
  const [weekDates, setWeekDates] = useState(getWeekDates(0));
  const [monthWeeks, setMonthWeeks] = useState(getMonthWeeks(0));
  const [schedule, setSchedule] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
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
      
      let settings;
      if (settingsData) {
        settings = {
          work_week: settingsData.work_week,
          operational_hours: settingsData.operational_hours,
          auto_schedule_rules: settingsData.auto_schedule_rules || { min_techs_per_shift: 1, max_techs_per_shift: 3, respect_day_off: true, respect_hours_limits: true },
          advanced_settings: settingsData.advanced_settings || null,
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
          auto_schedule_rules: { min_techs_per_shift: 1, max_techs_per_shift: 3, respect_day_off: true, respect_hours_limits: true },
          advanced_settings: null,
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
  };

  const handleShiftChange = (techId: string, date: string, shiftType: string) => {
    const newSchedule = { ...schedule, [techId]: { ...schedule[techId], [date]: shiftType } };
    setSchedule(newSchedule);
  };

  const handleAutoSchedule = () => {
    if (!shopSettings) {
      message.error("Shop settings not loaded");
      return;
    }
    
    const dates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates;
    const operationalHours = shopSettings.operational_hours;
    const workWeek = shopSettings.work_week;
    const autoRules = shopSettings.auto_schedule_rules;
    const advancedSettings = shopSettings.advanced_settings;
    
    let newSchedule: Record<string, Record<string, string>>;
    
    if (viewMode === "rotational") {
      newSchedule = rotateShifts(technicians, dates, operationalHours, workWeek);
    } else {
      newSchedule = distributeShifts(technicians, dates, operationalHours, workWeek, autoRules, advancedSettings);
    }
    
    setSchedule(newSchedule);
    message.success(viewMode === "rotational" ? "Rotational schedule generated." : "Auto-schedule applied with advanced overrides.");
  };

  const handleSaveSchedule = async () => {
    if (!currentShopId) return;
    
    setLoading(true);
    try {
      const dates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates).map(d => d.date) : weekDates.map(d => d.date);
      await supabaseClient.from("schedule").delete().eq("shop_id", currentShopId).in("date", dates);
      
      const newEntries: any[] = [];
      for (const tech of technicians) {
        for (const day of (viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates)) {
          const shiftValue = schedule[tech.id]?.[day.date] || "off";
          if (shiftValue !== "off") {
            newEntries.push({ shop_id: currentShopId, tech_id: tech.id, date: day.date, shift: shiftValue });
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
    { title: "Tech", dataIndex: "name", key: "name", fixed: "left" as const, width: 80 },
    ...displayDates.map((day) => ({
      title: day.display,
      key: day.date,
      width: 90,
      render: (_: any, record: any) => {
        const shiftValue = schedule[record.id]?.[day.date] || "off";
        
        return (
          <Select
            value={shiftValue}
            onChange={(v) => handleShiftChange(record.id, day.date, v)}
            style={{ width: "100%" }}
            size="small"
          >
            <Option value="off">OFF</Option>
            <Option value="morning">MORN</Option>
            <Option value="mid">MID</Option>
            <Option value="late">LATE</Option>
          </Select>
        );
      },
    })),
    { 
      title: "Hrs", 
      dataIndex: "hours", 
      key: "hours", 
      width: 50, 
      render: (_: any, record: any) => {
        if (!shopSettings) return 0;
        const total = calculateTotalHours(record.id, schedule, displayDates, shopSettings.operational_hours);
        return <span>{total.toFixed(1)}</span>;
      }
    },
  ];

  const dataSource = technicians.map((tech) => ({
    key: tech.id,
    id: tech.id,
    name: `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`,
    hours: shopSettings ? calculateTotalHours(tech.id, schedule, displayDates, shopSettings.operational_hours) : 0,
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
        <Table columns={columns} dataSource={dataSource} loading={loading} pagination={false} size="small" scroll={{ x: displayDates.length * 90 }} />
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