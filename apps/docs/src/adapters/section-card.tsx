import React from "react";
import { Card, Typography } from "antd";

const { Title } = Typography;

interface SectionCardProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, description, children }) => (
  <Card className="mb-6">
    {title && (
      <div className="mb-4">
        <Title level={5} className="!mb-1">{title}</Title>
        {description && <div className="text-sm text-gray-400">{description}</div>}
      </div>
    )}
    {children}
  </Card>
);
