import React, { useState, useEffect } from "react";
import { Table, Button, Select, Card, message, Switch, Space, Radio, Modal, Checkbox, Tag, Tooltip, Alert } from "antd";
import { SaveOutlined, ThunderboltOutlined, LeftOutlined, RightOutlined, CopyOutlined, WarningOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";
import dayjs from "dayjs";

const { Option } = Select;

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  min_hours: number;
  max_hours: number;
  primary_day_off: string;
  secondary_day_off: string;
  include_in_rotation?: boolean;
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

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_closed: boolean;
  open_time?: string;
  close_time?: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface AdvancedSettings {
  enable: boolean;
  day_overrides: { day: string; min_techs: number | null; max_techs: number | null }[];
}

interface AutoRules {
  min_techs_per_shift: number;
  max_techs_per_shift: number;
  respect_day_off: boolean;
  respect_hours_limits: boolean;
  manual_override_enabled: boolean;
  manual_override_weeks: number;
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

const getDayHoursDecimal = (openTime: string | null, closeTime: string | null): number => {
  if (!openTime || !closeTime) return 0;
  const openHour = parseFloat(openTime.split(":")[0]) + parseFloat(openTime.split(":")[1]) / 60;
  const closeHour = parseFloat(closeTime.split(":")[0]) + parseFloat(closeTime.split(":")[1]) / 60;
  const totalHours = closeHour - openHour;
  return Math.max(0, totalHours - 0.5);
};

const getDayHours = (openTime: string | null, closeTime: string | null): number => {
  return getDayHoursDecimal(openTime, closeTime);
};

const getTimeDisplay = (openTime: string | null, closeTime: string | null): string => {
  if (!openTime || !closeTime) return "Closed";
  return `${openTime} - ${closeTime}`;
};

const isHoliday = (date: string, holidays: Holiday[]): Holiday | undefined => {
  return holidays.find(h => h.date === date);
};

const getEffectiveDayInfo = (
  day: any,
  operationalHours: OperationalHours,
  workWeek: WorkWeek,
  holidays: Holiday[],
  shiftTemplates: ShiftTemplate[],
  dailyShiftSettings: any[]
): { isOpen: boolean; hours: number; timeDisplay: string; openTime: string | null; closeTime: string | null } => {
  const dayKey = day.dayKey as keyof WorkWeek;
  
  // Priority 1: Shop Closed
  if (!workWeek[dayKey]) {
    return { isOpen: false, hours: 0, timeDisplay: "Shop Closed", openTime: null, closeTime: null };
  }
  
  // Priority 2: Holiday
  const holiday = isHoliday(day.date, holidays);
  if (holiday) {
    if (holiday.is_closed) {
      return { isOpen: false, hours: 0, timeDisplay: "Holiday - Closed", openTime: null, closeTime: null };
    }
    if (holiday.open_time && holiday.close_time) {
      const hours = getDayHours(holiday.open_time, holiday.close_time);
      return { 
        isOpen: true, 
        hours: hours, 
        timeDisplay: `${holiday.open_time} - ${holiday.close_time} (Holiday)`,
        openTime: holiday.open_time,
        closeTime: holiday.close_time
      };
    }
  }
  
  // Priority 3: Check daily shift setting or default template
  const dailySetting = dailyShiftSettings?.find((d: any) => d.day === day.dayKey);
  let openTime: string | null = null;
  let closeTime: string | null = null;
  
  if (dailySetting?.template_id) {
    const template = shiftTemplates.find(t => t.id === dailySetting.template_id);
    if (template) {
      openTime = template.start_time;
      closeTime = template.end_time;
    }
  }
  
  // Fallback to operational hours
  if (!openTime) {
    const dayHours = operationalHours[day.dayKey as keyof OperationalHours];
    openTime = dayHours?.open || null;
    closeTime = dayHours?.close || null;
  }
  
  if (!openTime || !closeTime) {
    return { isOpen: false, hours: 0, timeDisplay: "No hours set", openTime: null, closeTime: null };
  }
  
  const hours = getDayHours(openTime, closeTime);
  return { 
    isOpen: true, 
    hours: hours, 
    timeDisplay: getTimeDisplay(openTime, closeTime),
    openTime: openTime,
    closeTime: closeTime
  };
};

const getEffectiveMinTechs = (
  day: string,
  defaultMin: number,
  advancedSettings: AdvancedSettings | null
): number => {
  if (advancedSettings?.enable) {
    const dayOverride = advancedSettings.day_overrides?.find((d) => d.day === day);
    if (dayOverride && dayOverride.min_techs !== null && dayOverride.min_techs !== undefined) {
      return dayOverride.min_techs;
    }
  }
  return defaultMin;
};

const getEffectiveMaxTechs = (
  day: string,
  defaultMax: number,
  advancedSettings: AdvancedSettings | null
): number => {
  if (advancedSettings?.enable) {
    const dayOverride = advancedSettings.day_overrides?.find((d) => d.day === day);
    if (dayOverride && dayOverride.max_techs !== null && dayOverride.max_techs !== undefined) {
      return dayOverride.max_techs;
    }
  }
  return defaultMax;
};

const generateSchedule = (
  technicians: Technician[],
  dates: any[],
  operationalHours: OperationalHours,
  workWeek: WorkWeek,
  holidays: Holiday[],
  shiftTemplates: ShiftTemplate[],
  dailyShiftSettings: any[],
  autoRules: AutoRules,
  advancedSettings: AdvancedSettings | null
): { schedule: Record<string, Record<string, string>>; warnings: string[] } => {
  const schedule: Record<string, Record<string, string>> = {};
  const warnings: string[] = [];
  
  // Initialize all techs to OFF for all days
  for (const tech of technicians) {
    schedule[tech.id] = {};
    for (const day of dates) {
      schedule[tech.id][day.date] = "off";
    }
  }
  
  // Track weekly hours per tech
  let weeklyHours: Record<string, number> = {};
  for (const tech of technicians) {
    weeklyHours[tech.id] = 0;
  }
  
  const openDaysCount = Object.values(workWeek).filter(v => v === true).length;
  const respectDayOff = autoRules.respect_day_off && openDaysCount > 5;
  
  // Process each day
  for (const day of dates) {
    const { isOpen, hours, openTime, closeTime } = getEffectiveDayInfo(
      day, operationalHours, workWeek, holidays, shiftTemplates, dailyShiftSettings
    );
    
    if (!isOpen) {
      continue;
    }
    
    let minTechs = getEffectiveMinTechs(day.dayKey, autoRules.min_techs_per_shift, advancedSettings);
    let maxTechs = getEffectiveMaxTechs(day.dayKey, autoRules.max_techs_per_shift, advancedSettings);
    
    // Get available technicians
    let availableTechs = [...technicians];
    
    if (respectDayOff) {
      availableTechs = availableTechs.filter(tech => 
        tech.primary_day_off !== day.name && tech.secondary_day_off !== day.name
      );
    }
    
    if (autoRules.respect_hours_limits) {
      availableTechs = availableTechs.filter(tech => {
        if (tech.max_hours > 0 && weeklyHours[tech.id] + hours > tech.max_hours) {
          return false;
        }
        return true;
      });
    }
    
    // Check if we have enough techs to meet minimum
    if (availableTechs.length < minTechs) {
      warnings.push(`${day.name}: Need ${minTechs} techs but only ${availableTechs.length} available. Consider overriding day off preferences.`);
      // Override day off to meet minimum
      availableTechs = [...technicians];
      if (autoRules.respect_hours_limits) {
        availableTechs = availableTechs.filter(tech => {
          if (tech.max_hours > 0 && weeklyHours[tech.id] + hours > tech.max_hours) {
            return false;
          }
          return true;
        });
      }
    }
    
    // Sort by current hours (lowest first) for fair distribution
    availableTechs.sort((a, b) => weeklyHours[a.id] - weeklyHours[b.id]);
    
    // Assign shifts
    const toAssign = Math.min(maxTechs, availableTechs.length);
    for (let i = 0; i < toAssign; i++) {
      const tech = availableTechs[i];
      schedule[tech.id][day.date] = openTime && closeTime ? `${openTime}-${closeTime}` : "work";
      weeklyHours[tech.id] += hours;
    }
  }
  
  // Enforce min hours (add shifts if below minimum)
  if (autoRules.respect_hours_limits) {
    for (const tech of technicians) {
      if (tech.min_hours > 0 && weeklyHours[tech.id] < tech.min_hours) {
        let neededHours = tech.min_hours - weeklyHours[tech.id];
        
        for (const day of dates) {
          if (neededHours <= 0) break;
          
          const { isOpen, hours, openTime, closeTime } = getEffectiveDayInfo(
            day, operationalHours, workWeek, holidays, shiftTemplates, dailyShiftSettings
          );
          
          if (!isOpen) continue;
          if (schedule[tech.id][day.date] !== "off") continue;
          
          const isDayOff = respectDayOff && (tech.primary_day_off === day.name || tech.secondary_day_off === day.name);
          if (isDayOff) continue;
          
          if (tech.max_hours > 0 && weeklyHours[tech.id] + hours > tech.max_hours) {
            continue;
          }
          
          schedule[tech.id][day.date] = openTime && closeTime ? `${openTime}-${closeTime}` : "work";
          weeklyHours[tech.id] += hours;
          neededHours -= hours;
        }
      }
    }
  }
  
  return { schedule, warnings };
};

export const Schedule: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [dailyShiftSettings, setDailyShiftSettings] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<{ 
    work_week: WorkWeek; 
    operational_hours: OperationalHours; 
    auto_schedule_rules: AutoRules; 
    advanced_settings: AdvancedSettings | null 
  } | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly" | "rotational">("weekly");
  const [currentOffset, setCurrentOffset] = useState(0);
  const [weekDates, setWeekDates] = useState(getWeekDates(0));
  const [monthWeeks, setMonthWeeks] = useState(getMonthWeeks(0));
  const [schedule, setSchedule] = useState<Record<string, Record<string, string>>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
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
          auto_schedule_rules: settingsData.auto_schedule_rules || { min_techs_per_shift: 1, max_techs_per_shift: 3, respect_day_off: true, respect_hours_limits: true, manual_override_enabled: false, manual_override_weeks: 0 },
          advanced_settings: settingsData.advanced_settings || null,
        };
        setHolidays(settingsData.holidays || []);
        setShiftTemplates(settingsData.shift_templates || []);
        setDailyShiftSettings(settingsData.daily_shift_settings || []);
      } else {
        settings = {
          work_week: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
          operational_hours: {
            monday: { open: "07:30", close: "16:00" },
            tuesday: { open: "07:30", close: "16:00" },
            wednesday: { open: "07:30", close: "16:00" },
            thursday: { open: "07:30", close: "16:00" },
            friday: { open: "07:30", close: "16:00" },
            saturday: { open: "08:00", close: "16:00" },
            sunday: { open: null, close: null },
          },
          auto_schedule_rules: { min_techs_per_shift: 1, max_techs_per_shift: 3, respect_day_off: true, respect_hours_limits: true, manual_override_enabled: false, manual_override_weeks: 0 },
          advanced_settings: null,
        };
        setHolidays([]);
        setShiftTemplates([]);
        setDailyShiftSettings([]);
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
    
    const result = generateSchedule(
      technicians, dates, operationalHours, workWeek, holidays, 
      shiftTemplates, dailyShiftSettings, autoRules, advancedSettings
    );
    
    setSchedule(result.schedule);
    setWarnings(result.warnings);
    
    if (result.warnings.length > 0) {
      message.warning(`Schedule generated with ${result.warnings.length} warning(s). Check the alert banner.`);
    } else {
      message.success("Schedule generated successfully.");
    }
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

  const calculateTechTotalHours = (techId: string): number => {
    if (!shopSettings) return 0;
    let total = 0;
    const dates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates;
    for (const day of dates) {
      const shiftValue = schedule[techId]?.[day.date] || "off";
      if (shiftValue !== "off") {
        const { hours } = getEffectiveDayInfo(
          day, shopSettings.operational_hours, shopSettings.work_week, holidays, shiftTemplates, dailyShiftSettings
        );
        total += hours;
      }
    }
    return total;
  };

  const displayDates = viewMode === "monthly" ? monthWeeks.flatMap(w => w.dates) : weekDates;
  
  const columns = [
    { title: "Tech", dataIndex: "name", key: "name", fixed: "left" as const, width: 120 },
    ...displayDates.map((day) => {
      const dayInfo = shopSettings ? getEffectiveDayInfo(
        day, shopSettings.operational_hours, shopSettings.work_week, holidays, shiftTemplates, dailyShiftSettings
      ) : { isOpen: true, hours: 0, timeDisplay: "", openTime: null, closeTime: null };
      
      return {
        title: (
          <div>
            <div>{day.display}</div>
            <div style={{ fontSize: "10px", color: dayInfo.isOpen ? "#4CAF50" : "#F44336" }}>
              {dayInfo.timeDisplay}
            </div>
          </div>
        ),
        key: day.date,
        width: 110,
        render: (_: any, record: any) => {
          const shiftValue = schedule[record.id]?.[day.date] || "off";
          const isOpen = dayInfo.isOpen;
          
          if (!isOpen) {
            return <Tag color="red" style={{ width: "100%", textAlign: "center" }}>CLOSED</Tag>;
          }
          
          const displayValue = shiftValue !== "off" && shiftValue !== "work" ? shiftValue : "WORK";
          
          return (
            <Select
              value={shiftValue === "off" ? "off" : "work"}
              onChange={(v) => handleShiftChange(record.id, day.date, v)}
              style={{ width: "100%" }}
              size="small"
            >
              <Option value="off">OFF</Option>
              <Option value="work">WORK ({dayInfo.timeDisplay})</Option>
            </Select>
          );
        },
      };
    }),
    { 
      title: "Hrs", 
      key: "hours", 
      width: 60, 
      render: (_: any, record: any) => {
        const total = calculateTechTotalHours(record.id);
        const tech = technicians.find(t => t.id === record.id);
        let color = "blue";
        if (tech) {
          if (tech.min_hours > 0 && total < tech.min_hours) color = "orange";
          if (tech.max_hours > 0 && total > tech.max_hours) color = "red";
        }
        return <Tag color={color}>{total.toFixed(1)}</Tag>;
      }
    },
  ];

  const dataSource = technicians.map((tech) => ({
    key: tech.id,
    id: tech.id,
    name: `${tech.first_name} ${tech.last_name}`,
  }));

  const openDaysCount = shopSettings ? Object.values(shopSettings.work_week).filter(v => v === true).length : 5;
  const isDayOffRespected = openDaysCount > 5;

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
        
        {/* Priority Legend */}
        <div style={{ marginBottom: "16px", padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "11px" }}>
            <span><Tag color="green">Priority 1</Tag> Shop Hours</span>
            <span><Tag color="green">Priority 2</Tag> Holidays</span>
            <span><Tag color="green">Priority 3</Tag> Min Techs Required</span>
            <span><Tag color={isDayOffRespected ? "green" : "orange"}>Priority 4</Tag> Day Off {isDayOffRespected ? "Respected" : "Ignored (≤5 days open)"}</span>
            <span><Tag color="green">Priority 5</Tag> Max Hours Limit</span>
            <span><Tag color="green">Priority 6</Tag> Min Hours (adds shifts if needed)</span>
          </div>
        </div>
        
        {/* Warnings Banner */}
        {warnings.length > 0 && (
          <Alert
            message="Scheduling Warnings"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            }
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            closable
            onClose={() => setWarnings([])}
            style={{ marginBottom: "16px", background: "rgba(230,81,0,0.2)", borderColor: "#E65100" }}
          />
        )}
        
        <Table columns={columns} dataSource={dataSource} loading={loading} pagination={false} size="small" scroll={{ x: displayDates.length * 110 }} />
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