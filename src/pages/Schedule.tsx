import React, { useState, useEffect } from "react";
import { Table, Button, Select, Card, message, Switch, Space, Radio, Modal, Checkbox, Tag, Tooltip, Alert, InputNumber, Divider, Statistic, Row, Col } from "antd";
import { SaveOutlined, ThunderboltOutlined, LeftOutlined, RightOutlined, CopyOutlined, WarningOutlined, DollarOutlined, ClockCircleOutlined, SettingOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";
import { Typography } from "antd";

const { Option } = Select;
const { Text } = Typography;

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  min_hours: number;
  max_hours: number;
  pay_rate: number;
  pay_type: string;
  primary_day_off: string;
  secondary_day_off: string;
  include_in_rotation: boolean;
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
  is_default: boolean;
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
  default_shift_hours: number;
  default_lunch_minutes: number;
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

const getMonthDays = (offset: number = 0) => {
  const today = new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const dayKey = daysOfWeek[dayLabels.indexOf(dayName)];
    days.push({
      name: dayName,
      dayKey: dayKey,
      date: d.toISOString().split("T")[0],
      display: `${dayName.slice(0,3)} ${d.getMonth() + 1}/${d.getDate()}`,
      dayOfMonth: d.getDate(),
    });
  }
  return days;
};

const getPaidHoursPerShift = (defaultShiftHours: number, lunchMinutes: number): number => {
  return defaultShiftHours - (lunchMinutes / 60);
};

const isHoliday = (date: string, holidays: Holiday[]): Holiday | undefined => {
  return holidays.find(h => h.date === date);
};

// Get display text for a shift - shows time range if no custom name, otherwise shows custom name
const getShiftDisplay = (template: ShiftTemplate | null, customName?: string): string => {
  if (customName) return customName;
  if (template) {
    // If template has a custom name (not default like "Morning"), use it
    if (template.name && !["Morning", "Mid", "Late"].includes(template.name)) {
      return template.name;
    }
    // Otherwise show time range
    return `${template.start_time}-${template.end_time}`;
  }
  return "WORK";
};

const getEffectiveDayInfo = (
  day: any,
  workWeek: WorkWeek,
  holidays: Holiday[],
  shiftTemplates: ShiftTemplate[],
  dailyShiftSettings: any[]
): { isOpen: boolean; shiftDisplay: string; shiftTemplateId: string | null; isReducedHoliday: boolean; holidayName?: string } => {
  const dayKey = day.dayKey as keyof WorkWeek;
  
  if (!workWeek[dayKey]) {
    return { isOpen: false, shiftDisplay: "Closed", shiftTemplateId: null, isReducedHoliday: false };
  }
  
  const holiday = isHoliday(day.date, holidays);
  if (holiday) {
    if (holiday.is_closed) {
      return { isOpen: false, shiftDisplay: "Holiday", shiftTemplateId: null, isReducedHoliday: false, holidayName: holiday.name };
    }
    if (holiday.open_time && holiday.close_time) {
      return { 
        isOpen: true, 
        shiftDisplay: `${holiday.open_time}-${holiday.close_time}`,
        shiftTemplateId: null,
        isReducedHoliday: true,
        holidayName: holiday.name
      };
    }
  }
  
  const dailySetting = dailyShiftSettings?.find((d: any) => d.day === day.dayKey);
  if (dailySetting?.template_id) {
    const template = shiftTemplates.find(t => t.id === dailySetting.template_id);
    if (template) {
      const display = getShiftDisplay(template, dailySetting.custom_name);
      return {
        isOpen: true,
        shiftDisplay: display,
        shiftTemplateId: template.id,
        isReducedHoliday: false
      };
    }
  }
  
  // Default: use first template or show WORK
  const defaultTemplate = shiftTemplates.find(t => t.is_default) || shiftTemplates[0];
  if (defaultTemplate) {
    const display = getShiftDisplay(defaultTemplate);
    return {
      isOpen: true,
      shiftDisplay: display,
      shiftTemplateId: defaultTemplate.id,
      isReducedHoliday: false
    };
  }
  
  return { 
    isOpen: true, 
    shiftDisplay: "WORK",
    shiftTemplateId: null,
    isReducedHoliday: false
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

const calculatePay = (hours: number, payRate: number, payType: string): number => {
  if (payType === "hourly") {
    return hours * payRate;
  } else if (payType === "flat") {
    return payRate;
  } else if (payType === "flag") {
    return hours * payRate;
  }
  return hours * payRate;
};

const generateSchedule = (
  technicians: Technician[],
  dates: any[],
  workWeek: WorkWeek,
  holidays: Holiday[],
  shiftTemplates: ShiftTemplate[],
  dailyShiftSettings: any[],
  autoRules: AutoRules,
  advancedSettings: AdvancedSettings | null
): { schedule: Record<string, Record<string, string>>; weeklyHours: Record<string, number>; weeklyPay: Record<string, number>; totalPay: number; warnings: string[]; holidayWarnings: string[] } => {
  const schedule: Record<string, Record<string, string>> = {};
  const warnings: string[] = [];
  const holidayWarnings: string[] = [];
  const paidHoursPerShift = getPaidHoursPerShift(autoRules.default_shift_hours, autoRules.default_lunch_minutes);
  
  for (const tech of technicians) {
    schedule[tech.id] = {};
    for (const day of dates) {
      schedule[tech.id][day.date] = "off";
    }
  }
  
  let weeklyHours: Record<string, number> = {};
  for (const tech of technicians) {
    weeklyHours[tech.id] = 0;
  }
  
  const openDaysCount = Object.values(workWeek).filter(v => v === true).length;
  const respectDayOff = autoRules.respect_day_off && openDaysCount > 5;
  
  for (const day of dates) {
    const { isOpen, shiftDisplay, isReducedHoliday, holidayName } = getEffectiveDayInfo(
      day, workWeek, holidays, shiftTemplates, dailyShiftSettings
    );
    
    if (!isOpen) {
      continue;
    }
    
    if (isReducedHoliday) {
      holidayWarnings.push(`${day.name} (${day.date}) - ${holidayName} has reduced hours: ${shiftDisplay}. Please review and adjust schedule manually if needed.`);
    }
    
    let minTechs = getEffectiveMinTechs(day.dayKey, autoRules.min_techs_per_shift, advancedSettings);
    let maxTechs = getEffectiveMaxTechs(day.dayKey, autoRules.max_techs_per_shift, advancedSettings);
    
    let availableTechs = [...technicians];
    
    if (respectDayOff) {
      availableTechs = availableTechs.filter(tech => 
        tech.primary_day_off !== day.name && tech.secondary_day_off !== day.name
      );
    }
    
    if (autoRules.respect_hours_limits) {
      availableTechs = availableTechs.filter(tech => {
        if (tech.max_hours > 0 && weeklyHours[tech.id] + paidHoursPerShift > tech.max_hours) {
          return false;
        }
        return true;
      });
    }
    
    if (availableTechs.length < minTechs) {
      warnings.push(`${day.name}: Need ${minTechs} techs but only ${availableTechs.length} available. Consider overriding day off preferences.`);
      availableTechs = [...technicians];
      if (autoRules.respect_hours_limits) {
        availableTechs = availableTechs.filter(tech => {
          if (tech.max_hours > 0 && weeklyHours[tech.id] + paidHoursPerShift > tech.max_hours) {
            return false;
          }
          return true;
        });
      }
    }
    
    availableTechs.sort((a, b) => weeklyHours[a.id] - weeklyHours[b.id]);
    
    const toAssign = Math.min(maxTechs, availableTechs.length);
    for (let i = 0; i < toAssign; i++) {
      const tech = availableTechs[i];
      schedule[tech.id][day.date] = shiftDisplay;
      weeklyHours[tech.id] += paidHoursPerShift;
    }
  }
  
  if (autoRules.respect_hours_limits) {
    for (const tech of technicians) {
      if (tech.min_hours > 0 && weeklyHours[tech.id] < tech.min_hours) {
        let neededHours = tech.min_hours - weeklyHours[tech.id];
        
        for (const day of dates) {
          if (neededHours <= 0) break;
          
          const { isOpen, shiftDisplay } = getEffectiveDayInfo(
            day, workWeek, holidays, shiftTemplates, dailyShiftSettings
          );
          
          if (!isOpen) continue;
          if (schedule[tech.id][day.date] !== "off") continue;
          
          const isDayOff = respectDayOff && (tech.primary_day_off === day.name || tech.secondary_day_off === day.name);
          if (isDayOff) continue;
          
          if (tech.max_hours > 0 && weeklyHours[tech.id] + paidHoursPerShift > tech.max_hours) {
            continue;
          }
          
          schedule[tech.id][day.date] = shiftDisplay;
          weeklyHours[tech.id] += paidHoursPerShift;
          neededHours -= paidHoursPerShift;
        }
      }
    }
  }
  
  const weeklyPay: Record<string, number> = {};
  let totalPay = 0;
  for (const tech of technicians) {
    weeklyPay[tech.id] = calculatePay(weeklyHours[tech.id], tech.pay_rate, tech.pay_type);
    totalPay += weeklyPay[tech.id];
  }
  
  return { schedule, weeklyHours, weeklyPay, totalPay, warnings, holidayWarnings };
};

export const Schedule: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [dailyShiftSettings, setDailyShiftSettings] = useState<any[]>([]);
  const [shopSettings, setShopSettings] = useState<{ 
    work_week: WorkWeek; 
    auto_schedule_rules: AutoRules; 
    advanced_settings: AdvancedSettings | null 
  } | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly" | "rotational">("weekly");
  const [currentOffset, setCurrentOffset] = useState(0);
  const [weekDates, setWeekDates] = useState(getWeekDates(0));
  const [monthDays, setMonthDays] = useState(getMonthDays(0));
  const [schedule, setSchedule] = useState<Record<string, Record<string, string>>>({});
  const [weeklyHours, setWeeklyHours] = useState<Record<string, number>>({});
  const [weeklyPay, setWeeklyPay] = useState<Record<string, number>>({});
  const [totalPay, setTotalPay] = useState<number>(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [holidayWarnings, setHolidayWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [tempShiftHours, setTempShiftHours] = useState<number>(8.5);
  const [tempLunchMinutes, setTempLunchMinutes] = useState<number>(30);
  const [rotationModalVisible, setRotationModalVisible] = useState(false);

  useEffect(() => {
    const shopId = localStorage.getItem("currentShopId");
    if (shopId) {
      setCurrentShopId(shopId);
      loadAllData(shopId);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "weekly") setWeekDates(getWeekDates(currentOffset));
    else if (viewMode === "monthly") setMonthDays(getMonthDays(currentOffset));
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
        .select("id, first_name, last_name, min_hours, max_hours, pay_rate, pay_type, primary_day_off, secondary_day_off, include_in_rotation")
        .eq("shop_id", shopId);
      if (techError) throw techError;
      const techsWithRotation = (techData || []).map((t: any) => ({ ...t, include_in_rotation: t.include_in_rotation !== false }));
      setTechnicians(techsWithRotation);
      
      const { data: settingsData, error: settingsError } = await supabaseClient
        .from("shop_settings")
        .select("*")
        .eq("shop_id", shopId)
        .single();
      
      let settings;
      if (settingsData) {
        settings = {
          work_week: settingsData.work_week,
          auto_schedule_rules: settingsData.auto_schedule_rules || { 
            min_techs_per_shift: 1, 
            max_techs_per_shift: 3, 
            respect_day_off: true, 
            respect_hours_limits: true, 
            manual_override_enabled: false, 
            manual_override_weeks: 0,
            default_shift_hours: 8.5,
            default_lunch_minutes: 30
          },
          advanced_settings: settingsData.advanced_settings || null,
        };
        setHolidays(settingsData.holidays || []);
        setShiftTemplates(settingsData.shift_templates || []);
        setDailyShiftSettings(settingsData.daily_shift_settings || []);
        if (settingsData.auto_schedule_rules) {
          setTempShiftHours(settingsData.auto_schedule_rules.default_shift_hours || 8.5);
          setTempLunchMinutes(settingsData.auto_schedule_rules.default_lunch_minutes || 30);
        }
      } else {
        settings = {
          work_week: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
          auto_schedule_rules: { 
            min_techs_per_shift: 1, 
            max_techs_per_shift: 3, 
            respect_day_off: true, 
            respect_hours_limits: true, 
            manual_override_enabled: false, 
            manual_override_weeks: 0,
            default_shift_hours: 8.5,
            default_lunch_minutes: 30
          },
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
    
    if (shopSettings) {
      const paidHoursPerShift = getPaidHoursPerShift(shopSettings.auto_schedule_rules.default_shift_hours, shopSettings.auto_schedule_rules.default_lunch_minutes);
      let tempHours: Record<string, number> = {};
      let tempPay: Record<string, number> = {};
      let tempTotal = 0;
      for (const tech of technicians) {
        let total = 0;
        for (const day of weekDates) {
          const shiftValue = scheduleMap[tech.id]?.[day.date] || "off";
          if (shiftValue !== "off") {
            total += paidHoursPerShift;
          }
        }
        tempHours[tech.id] = total;
        tempPay[tech.id] = calculatePay(total, tech.pay_rate, tech.pay_type);
        tempTotal += tempPay[tech.id];
      }
      setWeeklyHours(tempHours);
      setWeeklyPay(tempPay);
      setTotalPay(tempTotal);
    }
  };

  const handleShiftChange = (techId: string, date: string, shiftValue: string) => {
    const newSchedule = { ...schedule, [techId]: { ...schedule[techId], [date]: shiftValue } };
    setSchedule(newSchedule);
    
    if (shopSettings) {
      const paidHoursPerShift = getPaidHoursPerShift(shopSettings.auto_schedule_rules.default_shift_hours, shopSettings.auto_schedule_rules.default_lunch_minutes);
      let total = 0;
      const dates = viewMode === "monthly" ? monthDays : weekDates;
      for (const day of dates) {
        const shiftVal = newSchedule[techId]?.[day.date] || "off";
        if (shiftVal !== "off") {
          total += paidHoursPerShift;
        }
      }
      const newHours = { ...weeklyHours, [techId]: total };
      const newPay = { ...weeklyPay, [techId]: calculatePay(total, technicians.find(t => t.id === techId)?.pay_rate || 0, technicians.find(t => t.id === techId)?.pay_type || "hourly") };
      const newTotal = Object.values(newPay).reduce((sum, val) => sum + val, 0);
      setWeeklyHours(newHours);
      setWeeklyPay(newPay);
      setTotalPay(newTotal);
    }
  };

  const handleAutoSchedule = () => {
    if (!shopSettings) {
      message.error("Shop settings not loaded");
      return;
    }
    
    let dates = viewMode === "monthly" ? monthDays : weekDates;
    const workWeek = shopSettings.work_week;
    const autoRules = shopSettings.auto_schedule_rules;
    const advancedSettings = shopSettings.advanced_settings;
    
    let techsToSchedule = [...technicians];
    if (viewMode === "rotational") {
      techsToSchedule = technicians.filter(tech => tech.include_in_rotation !== false);
      if (techsToSchedule.length === 0) {
        message.warning("No technicians selected for rotation. Check the 'Include in Rotation' toggle on each technician.");
        return;
      }
    }
    
    const result = generateSchedule(
      techsToSchedule, dates, workWeek, holidays, shiftTemplates, dailyShiftSettings, autoRules, advancedSettings
    );
    
    setSchedule(result.schedule);
    setWeeklyHours(result.weeklyHours);
    setWeeklyPay(result.weeklyPay);
    setTotalPay(result.totalPay);
    setWarnings(result.warnings);
    setHolidayWarnings(result.holidayWarnings);
    
    if (result.holidayWarnings.length > 0) {
      message.warning(`Reduced holiday hours detected. Please review the schedule for ${result.holidayWarnings.length} day(s).`);
    } else if (result.warnings.length > 0) {
      message.warning(`Schedule generated with ${result.warnings.length} warning(s).`);
    } else {
      message.success("Schedule generated successfully.");
    }
  };

  const handleSaveSchedule = async () => {
    if (!currentShopId) return;
    
    setLoading(true);
    try {
      const dates = viewMode === "monthly" ? monthDays.map(d => d.date) : weekDates.map(d => d.date);
      await supabaseClient.from("schedule").delete().eq("shop_id", currentShopId).in("date", dates);
      
      const newEntries: any[] = [];
      for (const tech of technicians) {
        for (const day of (viewMode === "monthly" ? monthDays : weekDates)) {
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

  const handleUpdateRotationStatus = async (techId: string, includeInRotation: boolean) => {
    if (!currentShopId) return;
    
    const { error } = await supabaseClient
      .from("technicians")
      .update({ include_in_rotation: includeInRotation })
      .eq("id", techId)
      .eq("shop_id", currentShopId);
    
    if (error) {
      console.error("Error updating rotation status:", error);
      message.error("Failed to update rotation status");
    } else {
      setTechnicians(technicians.map(tech => 
        tech.id === techId ? { ...tech, include_in_rotation: includeInRotation } : tech
      ));
      message.success(`Technician ${includeInRotation ? "included in" : "excluded from"} rotation`);
    }
  };

  const handleSaveSettings = async () => {
    if (!currentShopId || !shopSettings) return;
    
    const updatedAutoRules = {
      ...shopSettings.auto_schedule_rules,
      default_shift_hours: tempShiftHours,
      default_lunch_minutes: tempLunchMinutes,
    };
    
    setShopSettings({ ...shopSettings, auto_schedule_rules: updatedAutoRules });
    
    const { error } = await supabaseClient
      .from("shop_settings")
      .upsert({
        shop_id: currentShopId,
        auto_schedule_rules: updatedAutoRules,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'shop_id',
      });
    
    if (error) {
      console.error("Error saving settings:", error);
      message.error("Failed to save settings");
    } else {
      message.success("Shift settings saved");
      setSettingsModalVisible(false);
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
    return weeklyHours[techId] || 0;
  };

  // Build shift options from templates - show time ranges
  const getShiftOptions = () => {
    const options = [{ value: "off", label: "OFF", display: "OFF" }];
    for (const template of shiftTemplates) {
      // Show time range unless operator has set a custom name in settings
      let display = `${template.start_time}-${template.end_time}`;
      if (template.name && !["Morning", "Mid", "Late"].includes(template.name)) {
        display = template.name;
      }
      options.push({
        value: display,
        label: display,
        display: display
      });
    }
    return options;
  };

  const shiftOptions = getShiftOptions();

  const weeklyColumns = [
    { title: "Tech", dataIndex: "name", key: "name", fixed: "left" as const, width: 120 },
    ...weekDates.map((day) => {
      const dayInfo = shopSettings ? getEffectiveDayInfo(
        day, shopSettings.work_week, holidays, shiftTemplates, dailyShiftSettings
      ) : { isOpen: true, shiftDisplay: "WORK", shiftTemplateId: null, isReducedHoliday: false };
      
      return {
        title: (
          <div>
            <div>{day.display}</div>
            <div style={{ fontSize: "10px", color: dayInfo.isOpen ? "#4CAF50" : "#F44336" }}>
              {dayInfo.isOpen ? "Open" : "Closed"}
            </div>
          </div>
        ),
        key: day.date,
        width: 110,
        render: (_: any, record: any) => {
          const currentShiftValue = schedule[record.id]?.[day.date] || "off";
          const isOpen = dayInfo.isOpen;
          
          if (!isOpen) {
            return <Tag color="red" style={{ width: "100%", textAlign: "center" }}>CLOSED</Tag>;
          }
          
          return (
            <Select
              value={currentShiftValue}
              onChange={(v) => handleShiftChange(record.id, day.date, v)}
              style={{ width: "100%" }}
              size="small"
            >
              {shiftOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.display}</Option>
              ))}
            </Select>
          );
        },
      };
    }),
    { 
      title: "Hours", 
      key: "hours", 
      width: 70, 
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
    { 
      title: "Pay", 
      key: "pay", 
      width: 80, 
      render: (_: any, record: any) => {
        const pay = weeklyPay[record.id] || 0;
        return <span style={{ color: "#E5E7EB" }}>${pay.toFixed(2)}</span>;
      }
    },
  ];

  const monthlyDataSource = technicians.map((tech) => {
    const days = monthDays.map(day => {
      const shiftValue = schedule[tech.id]?.[day.date] || "off";
      const dayInfo = shopSettings ? getEffectiveDayInfo(
        day, shopSettings.work_week, holidays, shiftTemplates, dailyShiftSettings
      ) : { isOpen: true, shiftDisplay: "WORK", shiftTemplateId: null, isReducedHoliday: false };
      
      let displayText = "OFF";
      let isClosed = false;
      
      if (!dayInfo.isOpen) {
        displayText = "CLOSED";
        isClosed = true;
      } else if (shiftValue !== "off") {
        displayText = shiftValue;
      }
      
      return {
        date: day.date,
        dayOfMonth: day.dayOfMonth,
        display: displayText,
        isClosed,
      };
    });
    return {
      key: tech.id,
      id: tech.id,
      name: `${tech.first_name} ${tech.last_name}`,
      days: days,
      tech: tech,
    };
  });

  const monthlyColumns = [
    { title: "Tech", dataIndex: "name", key: "name", fixed: "left" as const, width: 120 },
    ...monthDays.map((day) => ({
      title: day.display,
      key: day.date,
      width: 90,
      render: (_: any, record: any) => {
        const dayData = record.days.find((d: any) => d.date === day.date);
        if (dayData?.isClosed) {
          return <Tag color="red" style={{ width: "100%", textAlign: "center" }}>CLOSED</Tag>;
        }
        return (
          <Tag color={dayData?.display !== "OFF" ? "blue" : "default"} style={{ width: "100%", textAlign: "center" }}>
            {dayData?.display || "OFF"}
          </Tag>
        );
      },
    })),
    { 
      title: "Hours", 
      key: "hours", 
      width: 70, 
      render: (_: any, record: any) => {
        const total = weeklyHours[record.id] || 0;
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

  const weeklyDataSource = technicians.map((tech) => ({
    key: tech.id,
    id: tech.id,
    name: `${tech.first_name} ${tech.last_name}`,
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
            <Button icon={<LeftOutlined />} onClick={() => handleNavigate('prev')} size="small">Prev</Button>
            <span style={{ color: "#E5E7EB", fontSize: "12px" }}>{getPeriodLabel()}</span>
            <Button icon={<RightOutlined />} onClick={() => handleNavigate('next')} size="small">Next</Button>
            {viewMode === "weekly" && <Button icon={<CopyOutlined />} onClick={() => setCopyModalVisible(true)} size="small">Copy Month</Button>}
          </Space>
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsModalVisible(true)} size="small">
              Shift Settings
            </Button>
            {viewMode === "rotational" && (
              <Button 
                icon={<SettingOutlined />} 
                onClick={() => setRotationModalVisible(true)} 
                size="small"
              >
                Rotation Settings
              </Button>
            )}
            <Switch checked={autoMode} onChange={setAutoMode} size="small" />
            <span style={{ color: "#E5E7EB", fontSize: "12px" }}>{autoMode ? "Auto" : "Manual"}</span>
            {autoMode && <Button icon={<ThunderboltOutlined />} onClick={handleAutoSchedule} style={{ backgroundColor: "#2E7D32", color: "#FFF" }} size="small">Generate</Button>}
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveSchedule} loading={loading} size="small">Save</Button>
          </Space>
        </div>
        
        <Row gutter={16} style={{ marginBottom: "16px" }}>
          <Col span={8}>
            <Card size="small" style={{ background: "rgba(0,0,0,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
              <Statistic
                title="Total Weekly Payroll"
                value={totalPay}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: "#4CAF50" }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: "rgba(0,0,0,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
              <Statistic
                title="Total Tech Hours"
                value={Object.values(weeklyHours).reduce((a, b) => a + b, 0)}
                precision={1}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: "#1890FF" }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: "rgba(0,0,0,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
              <Statistic
                title="Avg Hourly Rate"
                value={totalPay > 0 ? totalPay / (Object.values(weeklyHours).reduce((a, b) => a + b, 0) || 1) : 0}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: "#E5E7EB" }}
              />
            </Card>
          </Col>
        </Row>
        
        {holidayWarnings.length > 0 && (
          <Alert
            message="Reduced Holiday Hours"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {holidayWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            }
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            closable
            onClose={() => setHolidayWarnings([])}
            style={{ marginBottom: "16px", background: "rgba(230,81,0,0.2)", borderColor: "#E65100" }}
          />
        )}
        
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
        
        {viewMode === "monthly" ? (
          <Table columns={monthlyColumns} dataSource={monthlyDataSource} loading={loading} pagination={false} size="small" scroll={{ x: monthDays.length * 90 }} />
        ) : (
          <Table columns={weeklyColumns} dataSource={weeklyDataSource} loading={loading} pagination={false} size="small" scroll={{ x: weekDates.length * 110 }} />
        )}
      </Card>
      
      <Modal title="Copy to Month" open={copyModalVisible} onOk={() => setCopyModalVisible(false)} onCancel={() => setCopyModalVisible(false)} footer={null}>
        <Checkbox.Group onChange={setSelectedWeeks} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
          {Array.from({ length: 4 }, (_, i) => i + 1).map((weekNum) => (
            <Checkbox key={weekNum} value={weekNum}>Week {weekNum}</Checkbox>
          ))}
        </Checkbox.Group>
        <Button type="primary" style={{ marginTop: 16, backgroundColor: "#2E7D32" }} onClick={() => setCopyModalVisible(false)}>Copy</Button>
      </Modal>
      
      <Modal
        title="Shift Settings"
        open={settingsModalVisible}
        onOk={handleSaveSettings}
        onCancel={() => setSettingsModalVisible(false)}
        okText="Save"
        cancelText="Cancel"
      >
        <div style={{ marginBottom: "16px" }}>
          <div style={{ marginBottom: "8px" }}>
            <Text style={{ color: "#E5E7EB" }}>Default Shift Length (hours)</Text>
            <Tooltip title="Total shift hours before lunch deduction">
              <QuestionCircleOutlined style={{ color: "#9CA3AF", marginLeft: "8px" }} />
            </Tooltip>
          </div>
          <InputNumber
            value={tempShiftHours}
            onChange={(val) => setTempShiftHours(val || 8.5)}
            min={1}
            max={12}
            step={0.5}
            style={{ width: "100%" }}
            addonAfter="hours"
          />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ marginBottom: "8px" }}>
            <Text style={{ color: "#E5E7EB" }}>Default Lunch Break (minutes)</Text>
            <Tooltip title="Unpaid lunch break deducted from shift">
              <QuestionCircleOutlined style={{ color: "#9CA3AF", marginLeft: "8px" }} />
            </Tooltip>
          </div>
          <InputNumber
            value={tempLunchMinutes}
            onChange={(val) => setTempLunchMinutes(val || 30)}
            min={0}
            max={120}
            step={15}
            style={{ width: "100%" }}
            addonAfter="minutes"
          />
        </div>
        <Divider />
        <Text type="secondary" style={{ fontSize: "12px" }}>
          Example: {tempShiftHours} hour shift - {tempLunchMinutes} min lunch = {(tempShiftHours - (tempLunchMinutes / 60)).toFixed(1)} paid hours per shift
        </Text>
      </Modal>
      
      <Modal
        title="Rotation Settings"
        open={rotationModalVisible}
        onCancel={() => setRotationModalVisible(false)}
        footer={null}
      >
        <Table
          dataSource={technicians}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: "Technician", dataIndex: "first_name", key: "first_name", render: (_, record) => `${record.first_name} ${record.last_name}` },
            {
              title: "Include in Rotation",
              key: "include_in_rotation",
              render: (_, record) => (
                <Switch
                  checked={record.include_in_rotation !== false}
                  onChange={(checked) => handleUpdateRotationStatus(record.id, checked)}
                />
              ),
            },
          ]}
        />
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Button onClick={() => setRotationModalVisible(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
};