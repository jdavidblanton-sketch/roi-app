import React, { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Card, Row, Col, Switch, InputNumber } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";

const { Option } = Select;

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  pay_rate: number;
  pay_type: "hourly" | "salary" | "flat" | "flag";
  is_salary: boolean;
  include_in_scheduling: boolean;
  min_hours: number;
  max_hours: number;
  primary_day_off: string;
  secondary_day_off: string;
  include_in_rotation: boolean;
}

const MAX_TECHS_PER_SHOP = 10;
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "None"];
const ROLES = ["Manager", "Assistant Manager", "Foreman", "Service Advisor", "Master Technician", "Technician", "Lube Tech", "Other"];

export const Technicians: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [form] = Form.useForm();
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [isSalary, setIsSalary] = useState(false);

  useEffect(() => {
    const shopId = localStorage.getItem("currentShopId");
    if (shopId) {
      setCurrentShopId(shopId);
      loadTechnicians(shopId);
    }
  }, []);

  const loadTechnicians = async (shopId: string) => {
    setLoading(true);
    const { data, error } = await supabaseClient
      .from("technicians")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading technicians:", error);
      message.error("Failed to load technicians");
    } else {
      setTechnicians(data || []);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    if (technicians.length >= MAX_TECHS_PER_SHOP) {
      message.error(`Maximum ${MAX_TECHS_PER_SHOP} technicians per shop`);
      return;
    }
    setEditingTech(null);
    setIsSalary(false);
    form.resetFields();
    form.setFieldsValue({
      pay_type: "hourly",
      include_in_scheduling: true,
      include_in_rotation: true,
      min_hours: 0,
      max_hours: 40,
      primary_day_off: "Sunday",
      secondary_day_off: "None",
      role: "Technician",
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Technician) => {
    setEditingTech(record);
    setIsSalary(record.is_salary);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentShopId) return;
    
    setLoading(true);
    const { error } = await supabaseClient
      .from("technicians")
      .delete()
      .eq("id", id)
      .eq("shop_id", currentShopId);

    if (error) {
      message.error("Failed to delete technician");
      console.error(error);
    } else {
      message.success("Technician deleted");
      loadTechnicians(currentShopId);
    }
    setLoading(false);
  };

  const handleSubmit = async (values: any) => {
    if (!currentShopId) {
      message.error("No shop selected");
      return;
    }
    
    setLoading(true);
    
    if (editingTech) {
      const { error } = await supabaseClient
        .from("technicians")
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email || null,
          phone: values.phone || null,
          role: values.role,
          pay_rate: parseFloat(values.pay_rate),
          pay_type: values.pay_type,
          is_salary: values.is_salary || false,
          include_in_scheduling: values.include_in_scheduling !== false,
          min_hours: values.min_hours || 0,
          max_hours: values.max_hours || 40,
          primary_day_off: values.primary_day_off,
          secondary_day_off: values.secondary_day_off,
          include_in_rotation: values.include_in_rotation !== false,
        })
        .eq("id", editingTech.id)
        .eq("shop_id", currentShopId);

      if (error) {
        console.error("Update error:", error);
        message.error("Failed to update technician: " + error.message);
      } else {
        message.success("Technician updated");
        setModalVisible(false);
        form.resetFields();
        loadTechnicians(currentShopId);
      }
    } else {
      const { error } = await supabaseClient.from("technicians").insert({
        shop_id: currentShopId,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || null,
        phone: values.phone || null,
        role: values.role,
        pay_rate: parseFloat(values.pay_rate),
        pay_type: values.pay_type,
        is_salary: values.is_salary || false,
        include_in_scheduling: values.include_in_scheduling !== false,
        min_hours: values.min_hours || 0,
        max_hours: values.max_hours || 40,
        primary_day_off: values.primary_day_off,
        secondary_day_off: values.secondary_day_off,
        include_in_rotation: values.include_in_rotation !== false,
      });

      if (error) {
        console.error("Insert error:", error);
        message.error("Failed to add technician: " + error.message);
      } else {
        message.success("Technician added");
        setModalVisible(false);
        form.resetFields();
        loadTechnicians(currentShopId);
      }
    }
    setLoading(false);
  };

  const columns = [
    { title: "Name", key: "name", render: (_: any, record: Technician) => `${record.first_name} ${record.last_name}`, width: 120 },
    { title: "Role", dataIndex: "role", key: "role", width: 120 },
    { title: "Email", dataIndex: "email", key: "email", width: 160 },
    { title: "Phone", dataIndex: "phone", key: "phone", width: 120 },
    { title: "Pay Rate", dataIndex: "pay_rate", key: "pay_rate", render: (rate: number, record: Technician) => record.is_salary ? `$${rate}/wk` : `$${rate}/hr`, width: 100 },
    { title: "Pay Type", dataIndex: "pay_type", key: "pay_type", width: 100 },
    { title: "Min Hrs", dataIndex: "min_hours", key: "min_hours", width: 70 },
    { title: "Max Hrs", dataIndex: "max_hours", key: "max_hours", width: 70 },
    { title: "Primary Off", dataIndex: "primary_day_off", key: "primary_day_off", width: 100 },
    { title: "In Schedule", dataIndex: "include_in_scheduling", key: "include_in_scheduling", render: (val: boolean) => val ? "Yes" : "No", width: 90 },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: any, record: Technician) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
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
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ color: "#E5E7EB", margin: 0 }}>
            Technicians ({technicians.length}/{MAX_TECHS_PER_SHOP})
          </h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ backgroundColor: "#2E7D32" }}>
            Add Technician
          </Button>
        </div>
        <Table
          dataSource={technicians}
          columns={columns}
          rowKey="id"
          style={{ background: "transparent" }}
          loading={loading}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingTech ? "Edit Technician" : "Add Technician"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            pay_type: "hourly",
            include_in_scheduling: true,
            include_in_rotation: true,
            min_hours: 0,
            max_hours: 40,
            primary_day_off: "Sunday",
            secondary_day_off: "None",
            role: "Technician",
            is_salary: false,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                <Select>
                  {ROLES.map(role => (
                    <Option key={role} value={role}>{role}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pay_type" label="Pay Type" rules={[{ required: true }]}>
                <Select onChange={(val) => setIsSalary(val === "salary")}>
                  <Option value="hourly">Hourly</Option>
                  <Option value="salary">Salary (weekly fixed)</Option>
                  <Option value="flat">Flat Rate (per job)</Option>
                  <Option value="flag">Flag Hours</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="pay_rate" label={isSalary ? "Weekly Salary ($)" : "Pay Rate ($)"} rules={[{ required: true }]}>
                <Input type="number" step="0.01" prefix="$" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_salary" hidden>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="min_hours" label="Min Hours / Week">
                <InputNumber min={0} max={168} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_hours" label="Max Hours / Week">
                <InputNumber min={0} max={168} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="primary_day_off" label="Primary Day Off">
                <Select>
                  {DAYS_OF_WEEK.map(day => (
                    <Option key={day} value={day}>{day}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="secondary_day_off" label="Secondary Day Off">
                <Select>
                  {DAYS_OF_WEEK.map(day => (
                    <Option key={day} value={day}>{day}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="include_in_scheduling" label="Include in Scheduling" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="include_in_rotation" label="Include in Rotational Scheduling" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: "#2E7D32" }} loading={loading}>
                {editingTech ? "Update" : "Add"}
              </Button>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};