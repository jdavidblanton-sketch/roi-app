import React, { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Card, Row, Col } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { supabaseClient } from "../utils";

const { Option } = Select;

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  pay_rate: number;
  pay_type: "hourly" | "flat" | "flag";
  min_hours: number;
  max_hours: number;
  primary_day_off: string;
  secondary_day_off: string;
}

const MAX_TECHS_PER_SHOP = 10;
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "None"];

export const Technicians: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [form] = Form.useForm();
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);

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
    form.resetFields();
    form.setFieldsValue({
      min_hours: 0,
      max_hours: 40,
      primary_day_off: "Sunday",
      secondary_day_off: "None",
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Technician) => {
    setEditingTech(record);
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
      window.dispatchEvent(new Event("techniciansUpdated"));
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
          email: values.email,
          phone: values.phone || "",
          pay_rate: parseFloat(values.pay_rate),
          pay_type: values.pay_type,
          min_hours: values.min_hours,
          max_hours: values.max_hours,
          primary_day_off: values.primary_day_off,
          secondary_day_off: values.secondary_day_off,
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
        window.dispatchEvent(new Event("techniciansUpdated"));
      }
    } else {
      const { error } = await supabaseClient.from("technicians").insert({
        shop_id: currentShopId,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone || "",
        pay_rate: parseFloat(values.pay_rate),
        pay_type: values.pay_type,
        min_hours: values.min_hours,
        max_hours: values.max_hours,
        primary_day_off: values.primary_day_off,
        secondary_day_off: values.secondary_day_off,
      });

      if (error) {
        console.error("Insert error:", error);
        message.error("Failed to add technician: " + error.message);
      } else {
        message.success("Technician added");
        setModalVisible(false);
        form.resetFields();
        loadTechnicians(currentShopId);
        window.dispatchEvent(new Event("techniciansUpdated"));
      }
    }
    setLoading(false);
  };

  const columns = [
    { title: "Name", key: "name", render: (_: any, record: Technician) => `${record.first_name} ${record.last_name}` },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Phone", dataIndex: "phone", key: "phone" },
    { title: "Pay Rate", dataIndex: "pay_rate", key: "pay_rate", render: (rate: number) => `$${rate}` },
    { title: "Pay Type", dataIndex: "pay_type", key: "pay_type" },
    { title: "Min Hours", dataIndex: "min_hours", key: "min_hours" },
    { title: "Max Hours", dataIndex: "max_hours", key: "max_hours" },
    { title: "Primary Day Off", dataIndex: "primary_day_off", key: "primary_day_off" },
    { title: "Secondary Day Off", dataIndex: "secondary_day_off", key: "secondary_day_off" },
    {
      title: "Actions",
      key: "actions",
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
        <Table dataSource={technicians} columns={columns} rowKey="id" style={{ background: "transparent" }} loading={loading} scroll={{ x: 1200 }} />
      </Card>

      <Modal
        title={editingTech ? "Edit Technician" : "Add Technician"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ 
          pay_type: "hourly",
          min_hours: 0,
          max_hours: 40,
          primary_day_off: "Sunday",
          secondary_day_off: "None"
        }}>
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

          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
            <Input />
          </Form.Item>

          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="pay_rate" label="Pay Rate" rules={[{ required: true }]}>
                <Input type="number" step="0.01" prefix="$" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pay_type" label="Pay Type" rules={[{ required: true }]}>
                <Select>
                  <Option value="hourly">Hourly</Option>
                  <Option value="flat">Flat Rate</Option>
                  <Option value="flag">Flag Hours</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="min_hours" label="Min Hours / Week">
                <Input type="number" min={0} max={168} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_hours" label="Max Hours / Week">
                <Input type="number" min={0} max={168} />
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