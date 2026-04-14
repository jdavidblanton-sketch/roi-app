import React, { useState, useEffect } from "react";
import { Table, Button, Select, Card, message, Switch, Space, Radio, Modal, Checkbox, Tag, Tooltip, Alert, InputNumber, Divider, Statistic, Row, Col, DatePicker, Tabs, List, Popconfirm, Input } from "antd";
import { SaveOutlined, ThunderboltOutlined, LeftOutlined, RightOutlined, CopyOutlined, WarningOutlined, DollarOutlined, ClockCircleOutlined, SettingOutlined, QuestionCircleOutlined, CalendarOutlined, UnorderedListOutlined, FolderOpenOutlined, DeleteOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";
import { Typography } from "antd";
import dayjs, { Dayjs } from "dayjs";

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
  include_in_scheduling: boolean;
  include_in_rotation: boolean;
  is_salary: boolean;
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

interface OperationalHours {
  monday: { open: string | null; close: string | null };
  tuesday: { open: string | null; close: string | null };
  wednesday: { open: string | null; close: string | null };
  thursday: { open: string | null; close: string | null };
  friday: { open: string | null; close: string | null };
  saturday: { open: string | null; close: string | null };
  sunday: { open: string | null; close: string | null };
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_closed: boolean;
  open_time?: string;
  close_time?: string;
}

interface ScheduleTemplate {
  id: string;
  name: string;
  duration: string;
  rotation_pattern: number;
  schedule_data: any;
}

type DurationType = "week" | "2weeks" | "month";
type ViewType = "list" | "calendar";

const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const getWeekDates = (startDate: Dayjs) => {
  return daysOfWeek.map((day, index) => {
    const date = startDate.add(index, "day");
    return { name: dayLabels[index], dayKey: day, date: date.format("YYYY-MM-DD"), display: `${dayLabels[index].slice(0,3)} ${date.format("MM/DD")}` };
  });
};

const get2WeeksDates = (startDate: Dayjs) => {
  const weeks = [];
  for (let week = 0; week < 2; week++) {
    const weekDates = [];
    for (let day = 0; day < 7; day++) {
      const date = startDate.add(week * 7 + day, "day");
      weekDates.push({
        name: dayLabels[day],
        dayKey: daysOfWeek[day],
        date: date.format("YYYY-MM-DD"),
        display: `${dayLabels[day].slice(0,3)} ${date.format("MM/DD")}`,
      });
    }
    weeks.push(weekDates);
  }
  return weeks;
};

const getMonthDates = (startDate: Dayjs) => {
  const year = startDate.year();
  const month = startDate.month();
  const firstDayOfMonth = dayjs(new Date(year, month, 1));
  const startDayOfWeek = firstDayOfMonth.day();
  const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const calendarStart = firstDayOfMonth.subtract(startOffset, "day");
  
  const weeks = [];
  for (let week = 0; week < 6; week++) {
    const weekDates = [];
    for (let day = 0; day < 7; day++) {
      const date = calendarStart.add(week * 7 + day, "day");
      const isCurrentMonth = date.month() === month;
      weekDates.push({
        name: dayLabels[day],
        dayKey: daysOfWeek[day],
        date: date.format("YYYY-MM-DD"),
        display: `${dayLabels[day].slice(0,3)} ${date.format("MM/DD")}`,
        isCurrentMonth,
      });
    }
    weeks.push(weekDates);
  }
  return weeks;
};

const getDayPaidHours = (day: any, operationalHours: OperationalHours, workWeek: WorkWeek, holidays: Holiday[], lunchMinutes: number): number => {
  const dayKey = day.dayKey as keyof WorkWeek;
  
  if (!workWeek[dayKey]) {
    return 0;
  }
  
  const holiday = holidays.find(h => h.date === day.date);
  if (holiday) {
    if (holiday.is_closed) return 0;
    if (holiday.open_time && holiday.close_time) {
      const openHour = parseFloat(holiday.open_time.split(":")[0]) + parseFloat(holiday.open_time.split(":")[1]) / 60;
      const closeHour = parseFloat(holiday.close_time.split(":")[0]) + parseFloat(holiday.close_time.split(":")[1]) / 60;
      return Math.max(0, (closeHour - openHour) - (lunchMinutes / 60));
    }
  }
  
  const dayHours = operationalHours[day.dayKey as keyof OperationalHours];
  if (!dayHours?.open || !dayHours?.close) {
    return 0;
  }
  
  const openHour = parseFloat(dayHours.open.split(":")[0]) + parseFloat(dayHours.open.split(":")[1]) / 60;
  const closeHour = parseFloat(dayHours.close.split(":")[0]) + parseFloat(dayHours.close.split(":")[1]) / 60;
  return Math.max(0, (closeHour - openHour) - (lunchMinutes / 60));
};

const getTimeDisplay = (day: any, operationalHours: OperationalHours, workWeek: WorkWeek, holidays: Holiday[]): string => {
  const dayKey = day.dayKey as keyof WorkWeek;
  
  if (!workWeek[dayKey]) {
    return "Closed";
  }
  
  const holiday = holidays.find(h => h.date === day.date);
  if (holiday) {
    if (holiday.is_closed) return "Holiday";
    if (holiday.open_time && holiday.close_time) return `${holiday.open_time}-${holiday.close_time}`;
  }
  
  const dayHours = operationalHours[day.dayKey as keyof OperationalHours];
  if (!dayHours?.open || !dayHours?.close) {
    return "No hours";
  }
  
  return `${dayHours.open}-${dayHours.close}`;
};

const calculatePay = (hours: number, payRate: number, payType: string): number => {
  if (payType === "hourly") return hours * payRate;
  if (payType === "salary") return payRate;
  if (payType === "flat") return payRate;
  if (payType === "flag") return hours * payRate;
  return hours * payRate;
};

const generateStaggeredShifts = (
  technicians: Technician[],
  dates: any[],
  operationalHours: OperationalHours,
  workWeek: WorkWeek,
  holidays: Holiday[],
  autoRules: any,
  lunchMinutes: number,
  rotationPattern: number
): Record<string, Record<string, string>> => {
  const schedule: Record<string, Record<string, string>> = {};
  
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
  
  let rotationIndex = 0;
  
  for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
    const day = dates[dayIndex];
    const hours = getDayPaidHours(day, operationalHours, workWeek, holidays, lunchMinutes);
    const isOpen = hours > 0;
    
    if (!isOpen) {
      continue;
    }
    
    let minTechs = autoRules.min_techs_per_shift;
    let maxTechs = autoRules.max_techs_per_shift;
    
    let availableTechs = technicians.filter(t => t.include_in_scheduling !== false);
    
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
    
    if (availableTechs.length < minTechs) {
      availableTechs = technicians.filter(t => t.include_in_scheduling !== false);
      if (respectDayOff) {
        availableTechs = availableTechs.filter(tech => 
          tech.primary_day_off !== day.name && tech.secondary_day_off !== day.name
        );
      }
    }
    
    availableTechs.sort((a, b) => weeklyHours[a.id] - weeklyHours[b.id]);
    
    const toAssign = Math.min(maxTechs, availableTechs.length);
    
    const patternOffset = rotationPattern > 0 ? Math.floor(dayIndex / rotationPattern) % availableTechs.length : 0;
    
    for (let i = 0; i < toAssign; i++) {
      const techIndex = (rotationIndex + i + patternOffset) % availableTechs.length;
      const tech = availableTechs[techIndex];
      schedule[tech.id][day.date] = "work";
      weeklyHours[tech.id] += hours;
    }
    
    rotationIndex = (rotationIndex + toAssign) % availableTechs.length;
  }
  
  return schedule;
};

export const Schedule: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [shopSettings, setShopSettings] = useState<{ 
    work_week: WorkWeek; 
    operational_hours: OperationalHours; 
    auto_schedule_rules: any; 
  } | null>(null);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [duration, setDuration] = useState<DurationType>("week");
  const [viewType, setViewType] = useState<ViewType>("list");
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().startOf("week"));
  const [rotationPattern, setRotationPattern] = useState<number>(7);
  const [customRotation, setCustomRotation] = useState<number>(7);
  const [schedule, setSchedule] = useState<Record<string, Record<string, string>>>({});
  const [weeklyHours, setWeeklyHours] = useState<Record<string, number>>({});
  const [weeklyPay, setWeeklyPay] = useState<Record<string, number>>({});
  const [totalPay, setTotalPay] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [saveTemplateModalVisible, setSaveTemplateModalVisible] = useState(false);
  const [loadTemplateModalVisible, setLoadTemplateModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [tempShiftHours, setTempShiftHours] = useState<number>(8.5);
  const [tempLunchMinutes, setTempLunchMinutes] = useState<number>(30);

  let dates: any[] = [];
  let weeks: any[][] = [];
  
  if (duration === "week") {
    dates = getWeekDates(startDate);
  } else if (duration === "2weeks") {
    weeks = get2WeeksDates(startDate);
    dates = weeks.flat();
  } else {
    weeks = getMonthDates(startDate);
    dates = weeks.flat();
  }

  useEffect(() => {
    const shopId = localStorage.getItem("currentShopId");
    if (shopId) {
      setCurrentShopId(shopId);
      loadAllData(shopId);
    }
  }, []);

  useEffect(() => {
    if (duration === "week") {
      setStartDate(dayjs().startOf("week"));
    }
  }, [duration]);

  // Only load schedule from database on initial load or when dates change
  useEffect(() => {
    if (currentShopId && settingsLoaded && technicians.length > 0 && !autoMode) {
      loadScheduleFromDatabase();
    }
  }, [dates, settingsLoaded, currentShopId]);

  const loadAllData = async (shopId: string) => {
    setLoading(true);
    try {
      const { data: techData, error: techError } = await supabaseClient
        .from("technicians")
        .select("*")
        .eq("shop_id", shopId);
      if (techError) throw techError;
      setTechnicians(techData || []);
      
      const { data: settingsData, error: settingsError } = await supabaseClient
        .from("shop_settings")
        .select("*")
        .eq("shop_id", shopId)
        .single();
      
      if (settingsData) {
        setShopSettings({
          work_week: settingsData.work_week,
          operational_hours: settingsData.operational_hours,
          auto_schedule_rules: settingsData.auto_schedule_rules,
        });
        setHolidays(settingsData.holidays || []);
        if (settingsData.auto_schedule_rules) {
          setTempShiftHours(settingsData.auto_schedule_rules.target_shift_hours || 8.5);
          setTempLunchMinutes(settingsData.auto_schedule_rules.lunch_minutes || 30);
        }
      }
      
      const { data: templateData, error: templateError } = await supabaseClient
        .from("schedule_templates")
        .select("*")
        .eq("shop_id", shopId);
      if (!templateError && templateData) {
        setTemplates(templateData);
      }
      
      setSettingsLoaded(true);
      
      // Load schedule from database
      if (techData && techData.length > 0) {
        await loadScheduleFromDatabase();
      }
    } catch (error) {
      console.error("Error loading data:", error);
      message.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const loadScheduleFromDatabase = async () => {
    if (!currentShopId) return;
    
    const dateStrings = dates.map(d => d.date);
    const { data: scheduleData, error: scheduleError } = await supabaseClient
      .from("schedule_entries")
      .select("*")
      .eq("shop_id", currentShopId)
      .in("date", dateStrings);
    
    if (scheduleError) {
      console.error("Error loading schedule:", scheduleError);
      return;
    }

    const scheduleMap: Record<string, Record<string, string>> = {};
    technicians.forEach((tech) => {
      scheduleMap[tech.id] = {};
      dateStrings.forEach((date) => {
        const existing = scheduleData?.find((s: any) => s.technician_id === tech.id && s.date === date);
        scheduleMap[tech.id][date] = existing ? "work" : "off";
      });
    });
    setSchedule(scheduleMap);
    
    if (shopSettings) {
      const lunchMinutes = shopSettings.auto_schedule_rules.lunch_minutes || 30;
      let tempHours: Record<string, number> = {};
      let tempPay: Record<string, number> = {};
      let tempTotal = 0;
      for (const tech of technicians) {
        let total = 0;
        for (const day of dates) {
          const shiftValue = scheduleMap[tech.id]?.[day.date] || "off";
          if (shiftValue !== "off") {
            total += getDayPaidHours(day, shopSettings.operational_hours, shopSettings.work_week, holidays, lunchMinutes);
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

  const handleGenerateSchedule = () => {
    if (!shopSettings) {
      message.error("Shop settings not loaded");
      return;
    }
    
    const autoRules = shopSettings.auto_schedule_rules;
    const lunchMinutes = autoRules.lunch_minutes || 30;
    
    let techsToSchedule = technicians.filter(t => t.include_in_scheduling !== false);
    
    const rotationDays = rotationPattern === 0 ? customRotation : rotationPattern;
    
    const newSchedule = generateStaggeredShifts(
      techsToSchedule, dates, shopSettings.operational_hours, shopSettings.work_week, 
      holidays, autoRules, lunchMinutes, rotationDays
    );
    
    // Directly set the schedule without loading from database
    setSchedule(newSchedule);
    
    // Calculate hours and pay for the generated schedule
    let tempHours: Record<string, number> = {};
    let tempPay: Record<string, number> = {};
    let tempTotal = 0;
    for (const tech of technicians) {
      let total = 0;
      for (const day of dates) {
        const shiftValue = newSchedule[tech.id]?.[day.date] || "off";
        if (shiftValue !== "off") {
          total += getDayPaidHours(day, shopSettings.operational_hours, shopSettings.work_week, holidays, lunchMinutes);
        }
      }
      tempHours[tech.id] = total;
      tempPay[tech.id] = calculatePay(total, tech.pay_rate, tech.pay_type);
      tempTotal += tempPay[tech.id];
    }
    setWeeklyHours(tempHours);
    setWeeklyPay(tempPay);
    setTotalPay(tempTotal);
    
    message.success("Schedule generated successfully");
  };

  const handleSaveSchedule = async () => {
    if (!currentShopId) return;
    
    setLoading(true);
    try {
      const dateStrings = dates.map(d => d.date);
      await supabaseClient
        .from("schedule_entries")
        .delete()
        .eq("shop_id", currentShopId)
        .in("date", dateStrings);
      
      const newEntries: any[] = [];
      for (const tech of technicians) {
        for (const day of dates) {
          const shiftValue = schedule[tech.id]?.[day.date] || "off";
          if (shiftValue !== "off") {
            const dayHours = getDayPaidHours(day, shopSettings!.operational_hours, shopSettings!.work_week, holidays, shopSettings!.auto_schedule_rules.lunch_minutes || 30);
            newEntries.push({ 
              shop_id: currentShopId, 
              technician_id: tech.id, 
              date: day.date, 
              shift_start: "09:00", 
              shift_end: "17:00",
              pay_earned: calculatePay(dayHours, tech.pay_rate, tech.pay_type)
            });
          }
        }
      }
      if (newEntries.length > 0) await supabaseClient.from("schedule_entries").insert(newEntries);
      message.success("Schedule saved!");
    } catch (error) {
      console.error(error);
      message.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      message.error("Please enter a template name");
      return;
    }
    if (!currentShopId) return;
    
    setLoading(true);
    try {
      const { error } = await supabaseClient.from("schedule_templates").insert({
        shop_id: currentShopId,
        name: templateName,
        duration: duration,
        rotation_pattern: rotationPattern === 0 ? customRotation : rotationPattern,
        schedule_data: schedule,
      });
      
      if (error) throw error;
      
      message.success("Template saved successfully");
      setSaveTemplateModalVisible(false);
      setTemplateName("");
      
      const { data: templateData } = await supabaseClient
        .from("schedule_templates")
        .select("*")
        .eq("shop_id", currentShopId);
      if (templateData) setTemplates(templateData);
    } catch (error) {
      console.error(error);
      message.error("Failed to save template");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = (template: ScheduleTemplate) => {
    setSchedule(template.schedule_data);
    
    if (shopSettings) {
      const lunchMinutes = shopSettings.auto_schedule_rules.lunch_minutes || 30;
      let tempHours: Record<string, number> = {};
      let tempPay: Record<string, number> = {};
      let tempTotal = 0;
      for (const tech of technicians) {
        let total = 0;
        for (const day of dates) {
          const shiftValue = template.schedule_data[tech.id]?.[day.date] || "off";
          if (shiftValue !== "off") {
            total += getDayPaidHours(day, shopSettings.operational_hours, shopSettings.work_week, holidays, lunchMinutes);
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
    
    message.success(`Loaded template: ${template.name}`);
    setLoadTemplateModalVisible(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabaseClient
      .from("schedule_templates")
      .delete()
      .eq("id", id);
    
    if (error) {
      message.error("Failed to delete template");
    } else {
      message.success("Template deleted");
      setTemplates(templates.filter(t => t.id !== id));
    }
  };

  const handleShiftChange = (techId: string, date: string, shiftValue: string) => {
    const newSchedule = { ...schedule, [techId]: { ...schedule[techId], [date]: shiftValue } };
    setSchedule(newSchedule);
    
    if (shopSettings) {
      const lunchMinutes = shopSettings.auto_schedule_rules.lunch_minutes || 30;
      let total = 0;
      for (const day of dates) {
        const shiftVal = newSchedule[techId]?.[day.date] || "off";
        if (shiftVal !== "off") {
          total += getDayPaidHours(day, shopSettings.operational_hours, shopSettings.work_week, holidays, lunchMinutes);
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

  const getDayDisplayInfo = (day: any) => {
    if (!shopSettings) return { isOpen: true, timeDisplay: "", hours: 0 };
    const hours = getDayPaidHours(day, shopSettings.operational_hours, shopSettings.work_week, holidays, shopSettings.auto_schedule_rules.lunch_minutes || 30);
    const timeDisplay = getTimeDisplay(day, shopSettings.operational_hours, shopSettings.work_week, holidays);
    return { isOpen: hours > 0, timeDisplay, hours };
  };

  const getShiftOptions = () => {
    return [
      { value: "off", label: "OFF", display: "OFF" },
      { value: "work", label: "WORK", display: "WORK" },
    ];
  };

  const shiftOptions = getShiftOptions();

  const listColumns = [
    { title: "Tech", dataIndex: "name", key: "name", fixed: "left" as const, width: 150 },
    ...dates.map((day) => {
      const dayInfo = getDayDisplayInfo(day);
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
        width: 90,
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
    { title: "Hours", key: "hours", width: 70, render: (_: any, record: any) => {
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
    { title: "Pay", key: "pay", width: 80, render: (_: any, record: any) => {
        const pay = weeklyPay[record.id] || 0;
        return <span style={{ color: "#E5E7EB" }}>${pay.toFixed(2)}</span>;
      }
    },
  ];

  const listDataSource = technicians.filter(t => t.include_in_scheduling !== false).map((tech) => ({
    key: tech.id,
    id: tech.id,
    name: `${tech.first_name} ${tech.last_name}`,
  }));

  const renderCalendarView = () => {
    if (duration === "week") {
      const weekDates = dates;
      return (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ padding: "12px", textAlign: "left", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>Technician</th>
                {weekDates.map((day) => (
                  <th key={day.date} style={{ padding: "12px", textAlign: "center", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div>{day.display}</div>
                    <div style={{ fontSize: "10px", color: "#9CA3AF" }}>{getDayDisplayInfo(day).timeDisplay}</div>
                  </th>
                ))}
                <th style={{ padding: "12px", textAlign: "center", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>Hours</th>
                <th style={{ padding: "12px", textAlign: "center", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>Pay</th>
              </tr>
            </thead>
            <tbody>
              {technicians.filter(t => t.include_in_scheduling !== false).map((tech) => (
                <tr key={tech.id}>
                  <td style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>{tech.first_name} {tech.last_name}</td>
                  {weekDates.map((day) => {
                    const dayInfo = getDayDisplayInfo(day);
                    const shiftValue = schedule[tech.id]?.[day.date] || "off";
                    return (
                      <td key={day.date} style={{ padding: "8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: !dayInfo.isOpen ? "rgba(244,67,54,0.1)" : "transparent" }}>
                        {!dayInfo.isOpen ? (
                          <Tag color="red">CLOSED</Tag>
                        ) : (
                          <Select
                            value={shiftValue}
                            onChange={(v) => handleShiftChange(tech.id, day.date, v)}
                            style={{ width: "80px" }}
                            size="small"
                          >
                            {shiftOptions.map(opt => (<Option key={opt.value} value={opt.value}>{opt.display}</Option>))}
                          </Select>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: "12px", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <Tag color={weeklyHours[tech.id] > (technicians.find(t => t.id === tech.id)?.max_hours || 0) ? "red" : "blue"}>
                      {(weeklyHours[tech.id] || 0).toFixed(1)}
                    </Tag>
                  </td>
                  <td style={{ padding: "12px", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
                    ${(weeklyPay[tech.id] || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else {
      return (
        <div style={{ overflowX: "auto" }}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} style={{ marginBottom: "24px" }}>
              <h4 style={{ color: "#E5E7EB", marginBottom: "12px" }}>Week {weekIndex + 1}</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px", textAlign: "left", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>Technician</th>
                    {week.map((day) => (
                      <th key={day.date} style={{ padding: "12px", textAlign: "center", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div>{day.display}</div>
                        <div style={{ fontSize: "10px", color: "#9CA3AF" }}>{getDayDisplayInfo(day).timeDisplay}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {technicians.filter(t => t.include_in_scheduling !== false).map((tech) => (
                    <tr key={tech.id}>
                      <td style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>{tech.first_name} {tech.last_name}</td>
                      {week.map((day) => {
                        const dayInfo = getDayDisplayInfo(day);
                        const shiftValue = schedule[tech.id]?.[day.date] || "off";
                        return (
                          <td key={day.date} style={{ padding: "8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: !dayInfo.isOpen ? "rgba(244,67,54,0.1)" : "transparent" }}>
                            {!dayInfo.isOpen ? (
                              <Tag color="red">CLOSED</Tag>
                            ) : (
                              <Select
                                value={shiftValue}
                                onChange={(v) => handleShiftChange(tech.id, day.date, v)}
                                style={{ width: "80px" }}
                                size="small"
                              >
                                {shiftOptions.map(opt => (<Option key={opt.value} value={opt.value}>{opt.display}</Option>))}
                              </Select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      <Card style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <Space>
            <Radio.Group value={duration} onChange={(e) => setDuration(e.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="week">1 Week</Radio.Button>
              <Radio.Button value="2weeks">2 Weeks</Radio.Button>
              <Radio.Button value="month">Month</Radio.Button>
            </Radio.Group>
            
            {duration !== "week" && (
              <DatePicker
                value={startDate}
                onChange={(date) => date && setStartDate(date)}
                picker={duration === "month" ? "month" : "date"}
                format={duration === "month" ? "MMMM YYYY" : "MM/DD/YYYY"}
                size="small"
              />
            )}
            
            <Select value={rotationPattern} onChange={setRotationPattern} style={{ width: "140px" }} size="small">
              <Option value={7}>Rotate Every 7 Days</Option>
              <Option value={14}>Rotate Every 14 Days</Option>
              <Option value={0}>Custom Pattern</Option>
            </Select>
            
            {rotationPattern === 0 && (
              <InputNumber
                placeholder="Custom days"
                value={customRotation}
                onChange={(val) => setCustomRotation(val || 7)}
                min={1}
                max={30}
                size="small"
                style={{ width: "120px" }}
              />
            )}
            
            <Button icon={<SettingOutlined />} onClick={() => setSettingsModalVisible(true)} size="small">
              Settings
            </Button>
          </Space>
          
          <Space>
            <Radio.Group value={viewType} onChange={(e) => setViewType(e.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="list"><UnorderedListOutlined /> List</Radio.Button>
              <Radio.Button value="calendar"><CalendarOutlined /> Calendar</Radio.Button>
            </Radio.Group>
            
            <Button icon={<FolderOpenOutlined />} onClick={() => setLoadTemplateModalVisible(true)} size="small">
              Load Template
            </Button>
            
            <Button icon={<SaveOutlined />} onClick={() => setSaveTemplateModalVisible(true)} size="small">
              Save as Template
            </Button>
            
            <Switch checked={autoMode} onChange={setAutoMode} size="small" />
            <span style={{ color: "#E5E7EB", fontSize: "12px" }}>{autoMode ? "Auto" : "Manual"}</span>
            {autoMode && <Button icon={<ThunderboltOutlined />} onClick={handleGenerateSchedule} style={{ backgroundColor: "#2E7D32", color: "#FFF" }} size="small">Generate</Button>}
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveSchedule} loading={loading} size="small">Save</Button>
          </Space>
        </div>
        
        <Row gutter={16} style={{ marginBottom: "16px" }}>
          <Col span={8}>
            <Card size="small" style={{ background: "rgba(0,0,0,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
              <Statistic
                title="Total Payroll"
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
                title="Total Hours"
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
        
        {viewType === "list" ? (
          <Table columns={listColumns} dataSource={listDataSource} loading={loading} pagination={false} size="small" scroll={{ x: dates.length * 90 }} />
        ) : (
          renderCalendarView()
        )}
      </Card>
      
      <Modal
        title="Save as Template"
        open={saveTemplateModalVisible}
        onOk={handleSaveAsTemplate}
        onCancel={() => { setSaveTemplateModalVisible(false); setTemplateName(""); }}
        okText="Save"
        cancelText="Cancel"
      >
        <Input
          placeholder="Template name (e.g., 'Summer Schedule', 'Standard Week')"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          style={{ marginTop: "16px" }}
        />
      </Modal>
      
      <Modal
        title="Load Template"
        open={loadTemplateModalVisible}
        onCancel={() => setLoadTemplateModalVisible(false)}
        footer={null}
        width={500}
      >
        <List
          dataSource={templates}
          renderItem={(template) => (
            <List.Item
              actions={[
                <Button type="link" onClick={() => handleLoadTemplate(template)}>Load</Button>,
                <Popconfirm title="Delete this template?" onConfirm={() => handleDeleteTemplate(template.id)}>
                  <Button type="link" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                title={template.name}
                description={`${template.duration} | Rotation: ${template.rotation_pattern} days`}
              />
            </List.Item>
          )}
        />
      </Modal>
      
      <Modal
        title="Schedule Settings"
        open={settingsModalVisible}
        onOk={() => setSettingsModalVisible(false)}
        onCancel={() => setSettingsModalVisible(false)}
        okText="Close"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <div style={{ marginBottom: "16px" }}>
          <Text style={{ color: "#E5E7EB" }}>Target Shift Hours: {tempShiftHours}</Text>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <Text style={{ color: "#E5E7EB" }}>Lunch Break: {tempLunchMinutes} minutes</Text>
        </div>
        <Divider />
        <Text type="secondary">
          Paid hours per shift: {tempShiftHours} - {tempLunchMinutes}/60 = {(tempShiftHours - (tempLunchMinutes / 60)).toFixed(1)} hours
        </Text>
      </Modal>
    </div>
  );
};